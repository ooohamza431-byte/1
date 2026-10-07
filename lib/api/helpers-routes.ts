import { requireUser, requireAdmin } from '@/lib/auth/rbac';

/**
 * Tiny indirection layer so route files can import auth helpers from a single
 * place without pulling the whole RBAC module into client bundles by accident.
 * (Route handlers are server-only; the `server-only` marker would be added here
 * if any of these were ever imported from a component.)
 */

export async function requireUserHelper() {
  return requireUser();
}

export async function requireAdminHelper() {
  return requireAdmin();
}
