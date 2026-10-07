import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/constants';

/**
 * Auth.js module augmentation.
 *
 * Adds the M1-specific claims to the Session, User and JWT types so that every
 * `session.user.role` read is checked by the compiler instead of being cast by
 * hand at each call site.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      banned: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role?: Role;
    banned?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: Role;
    banned?: boolean;
    /** Epoch ms of the last database refresh of role/ban claims. */
    checkedAt?: number;
  }
}

export {};
