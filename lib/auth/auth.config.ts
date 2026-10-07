import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import type { Role } from '@/lib/constants';

/**
 * Edge-safe Auth.js configuration.
 *
 * `middleware.ts` runs on the Edge runtime, where `node:crypto`, `bcryptjs` and
 * the `postgres` driver are unavailable. This file therefore contains ONLY the
 * parts of the config that can run there: OAuth provider registration, page
 * routes and the JWT/session callbacks that read values already baked into the
 * token.
 *
 * Anything that touches the database (the credentials provider, role promotion,
 * ban checks, last-active updates) lives in `auth.ts`, which is Node-only.
 */

/** OAuth providers are only registered when both halves of the pair exist. */
function oauthProviders() {
  const providers: NextAuthConfig['providers'] = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  return providers;
}

export const authConfig = {
  providers: oauthProviders(),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    // JWT sessions keep the admin role available to middleware without a DB
    // round-trip on every navigation.
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  callbacks: {
    /**
     * Runs on sign-in (user present) and on every subsequent request.
     * Only token-local reads/writes happen here so the Edge runtime is happy;
     * `auth.ts` layers the database refresh on top.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const claims = user as unknown as { id?: string; role?: Role; banned?: boolean };
        token.uid = claims.id ?? token.sub ?? '';
        token.role = (claims.role ?? 'user') as Role;
        token.banned = Boolean(claims.banned);
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.picture = user.image ?? token.picture;
      }
      // Allow the client to push a refreshed identity after a profile update.
      if (trigger === 'update' && session) {
        const patch = session as { name?: string; image?: string };
        if (patch.name) token.name = patch.name;
        if (patch.image) token.picture = patch.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? token.sub ?? '';
        session.user.role = ((token.role as Role) ?? 'user') as Role;
        session.user.banned = Boolean(token.banned);
        session.user.email = (token.email as string) ?? session.user.email;
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
