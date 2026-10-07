import { auth } from './auth';
import { PERMISSIONS, ROLE_RANK, hasRoleAtLeast, isAdminRole, isOwnerRole, type Permission, type Role } from '@/lib/constants';

/**
 * Role-based access control.
 *
 * Roles are ranked (`user` < `admin` < `owner`), and permissions are mapped to
 * the minimum role that may exercise them. Every admin API route calls
 * `requirePermission()` (or `requireAdmin()`), which reads the session
 * server-side — never from a header or client payload.
 */

export const PERMISSION_MIN_ROLE: Record<Permission, Role> = {
  'admin.access': 'admin',
  'keys.read': 'admin',
  'keys.write': 'admin',
  'users.read': 'admin',
  'users.write': 'admin',
  'users.delete': 'owner',
  'users.impersonate': 'admin',
  'features.write': 'admin',
  'providers.write': 'admin',
  'moderation.read': 'admin',
  'moderation.write': 'admin',
  'analytics.read': 'admin',
  'audit.read': 'admin',
  'system.write': 'owner',
};

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  banned: boolean;
}

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 401, code = 'unauthorized') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export function roleRank(role: Role | undefined | null): number {
  if (!role) return -1;
  return ROLE_RANK[role] ?? -1;
}

export function hasRole(role: Role | undefined | null, required: Role): boolean {
  return roleRank(role) >= roleRank(required);
}

/** Alias kept for call sites that predate the shared helpers in constants. */
export const isOwner = isOwnerRole;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  const minimum = PERMISSION_MIN_ROLE[permission];
  if (!minimum) return false;
  return hasRole(role, minimum);
}

export function permissionsFor(role: Role | undefined | null): Permission[] {
  return PERMISSIONS.filter((permission) => can(role, permission));
}

/* -------------------------------------------------------------------------- */
/*  Server-side session helpers                                               */
/* -------------------------------------------------------------------------- */

/** The current session user, or null when signed out. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string | null; name?: string | null; image?: string | null; role?: Role; banned?: boolean }
    | undefined;
  if (!session || !user?.email) return null;

  return {
    id: user.id ?? '',
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    role: (user.role as Role) ?? 'user',
    banned: Boolean(user.banned),
  };
}

/** Requires any signed-in, non-banned user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('You must be signed in.', 401, 'unauthenticated');
  if (user.banned) throw new AuthError('This account is suspended.', 403, 'banned');
  return user;
}

/** Requires the admin role or higher. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) {
    throw new AuthError('Administrator access required.', 403, 'forbidden');
  }
  return user;
}

/** Requires a specific permission (which may need `owner`). */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new AuthError(`Missing permission: ${permission}`, 403, 'forbidden');
  }
  return user;
}

/**
 * Re-checks the ban flag against the database. The JWT refreshes every five
 * minutes, so a mutation route should call this before doing anything that has
 * side effects for a suspected-bad actor.
 */
export async function requireFreshUser(): Promise<SessionUser> {
  const user = await requireUser();
  const { getUserById } = await import('@/lib/db/queries');
  const record = await getUserById(user.id);
  if (!record) throw new AuthError('Account no longer exists.', 401, 'unauthenticated');
  if (record.banned) throw new AuthError('This account is suspended.', 403, 'banned');
  return { ...user, role: record.role, banned: record.banned };
}

/** Re-exported for server-side callers (definitions live in constants). */
export { isAdminRole, isOwnerRole, hasRoleAtLeast };
