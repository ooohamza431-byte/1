import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { getUserByEmail, touchLastActive, upsertOAuthUser, verifyUserPassword } from '@/lib/db/queries';
import { isFeatureEnabled } from '@/lib/db/admin-queries';
import type { Role } from '@/lib/constants';

/**
 * Full Auth.js (NextAuth v5) configuration — Node runtime only.
 *
 * Layered on top of `authConfig`:
 *   • the email+password provider used by admins/owners,
 *   • first-login user creation with `OWNER_EMAIL` promotion,
 *   • ban enforcement at sign-in and on every JWT refresh,
 *   • throttled `lastActiveAt` bookkeeping for the analytics dashboard.
 *
 * Session strategy is JWT (set in authConfig) so the `role` claim is readable
 * from middleware without a database query.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

class BannedError extends CredentialsSignin {
  code = 'banned';
  message = 'This account has been suspended. Contact an administrator.';
}

class NotAllowedError extends CredentialsSignin {
  code = 'credentials_disabled';
  message = 'Email + password sign-in is disabled. Use an OAuth provider.';
}

class SignupDisabledError extends CredentialsSignin {
  code = 'signup_disabled';
  message = 'This instance is invite-only. Ask an administrator for access.';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        if (!(await isFeatureEnabled('credentials_login'))) {
          throw new NotAllowedError();
        }

        const { email, password } = parsed.data;
        const user = await verifyUserPassword(email, password);
        if (!user) return null;
        if (user.banned) throw new BannedError();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          banned: user.banned,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /** Runs after a successful provider sign-in. Creates/refreshes the user row. */
    async signIn({ user, account, profile }) {
      const email = (user.email ?? profile?.email ?? '').toString().trim().toLowerCase();
      if (!email) return false;

      try {
        if (account?.provider === 'credentials') {
          // Already validated against the database in `authorize()`.
          const existing = await getUserByEmail(email);
          if (!existing || existing.banned) return false;
          await touchLastActive(existing.id);
          return true;
        }

        const existing = await getUserByEmail(email);

        if (!existing) {
          // First-ever sign-in: honour the signup feature flag.
          const signupEnabled = await isFeatureEnabled('signup');
          if (!signupEnabled) throw new SignupDisabledError();
        }

        const record = await upsertOAuthUser({
          email,
          name: user.name ?? (profile?.name as string | undefined) ?? null,
          image: user.image ?? (profile?.picture as string | undefined) ?? null,
        });

        if (record.banned) throw new BannedError();

        // Copy the database identity onto the object the jwt callback receives.
        user.id = record.id;
        (user as { role?: Role }).role = record.role;
        (user as { banned?: boolean }).banned = record.banned;

        await touchLastActive(record.id);
        return true;
      } catch (error) {
        if (error instanceof CredentialsSignin) throw error;
        console.error('[auth] signIn failed', error);
        return false;
      }
    },

    /**
     * Refreshes role/ban state from the database at most once every 5 minutes
     * (roles must take effect without forcing users to sign out, but not at the
     * cost of a query per request).
     */
    async jwt({ token, user, trigger, session }) {
      const base = await authConfig.callbacks.jwt({ token, user, trigger, session } as never);
      const enriched = base as typeof token & { checkedAt?: number; uid?: string };

      const CHECK_INTERVAL = 5 * 60 * 1000;
      const uid = (enriched.uid as string) || enriched.sub;
      const isFreshEnough = enriched.checkedAt && Date.now() - (enriched.checkedAt as number) < CHECK_INTERVAL;

      if (uid && (!isFreshEnough || user)) {
        try {
          const { getUserById } = await import('@/lib/db/queries');
          const record = await getUserById(uid);
          if (record) {
            enriched.role = record.role;
            enriched.banned = record.banned;
            enriched.name = record.name ?? enriched.name;
            enriched.picture = record.image ?? enriched.picture;
          } else {
            // The user row was deleted — invalidate the session.
            return { ...enriched, banned: true, role: 'user' as Role };
          }
        } catch {
          /* transient database error: keep the existing claims */
        }
        enriched.checkedAt = Date.now();
      }

      return enriched;
    },

    async session({ session, token }) {
      const result = await authConfig.callbacks.session({ session, token } as never);
      return result;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser) {
        const { logAdminAction } = await import('@/lib/audit/log');
        void logAdminAction({
          adminId: user.id ?? null,
          adminEmail: user.email ?? null,
          action: 'auth.signup',
          targetType: 'user',
          targetId: user.id ?? null,
          details: { email: user.email },
        });
      }
    },
  },
});

export { BannedError };
