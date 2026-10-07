import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import { adminAuditLog } from '@/lib/db/schema';
import { listAuditLog } from '@/lib/db/admin-queries';

/**
 * Admin audit logging.
 *
 * Every mutating admin action funnels through `logAdminAction`, which records
 * who did what, to which target, from which IP/UA. The writer is intentionally
 * fire-and-forget: an audit failure must never take down the action the admin
 * actually requested, but it is surfaced on the server console.
 */

export type AuditAction =
  | 'key.create'
  | 'key.update'
  | 'key.delete'
  | 'key.bulk_import'
  | 'key.test'
  | 'user.role_change'
  | 'user.ban'
  | 'user.unban'
  | 'user.delete'
  | 'user.quota_update'
  | 'user.rate_limit_reset'
  | 'user.impersonate'
  | 'feature.toggle'
  | 'feature.bulk_update'
  | 'provider.update'
  | 'provider.reorder'
  | 'provider.custom_create'
  | 'provider.custom_update'
  | 'provider.custom_delete'
  | 'moderation.pattern_create'
  | 'moderation.pattern_delete'
  | 'moderation.flag_message'
  | 'moderation.export'
  | 'system.settings_update'
  | 'system.backup'
  | 'system.seed'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.login_failed';

export interface AuditContext {
  adminId: string | null;
  adminEmail: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

/** Extract the caller's IP + UA from the request headers (Next 15 async API). */
async function requestFingerprint(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip =
      (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      null;
    return { ip, userAgent: h.get('user-agent') };
  } catch {
    // Called outside a request scope (e.g. from a script) — not fatal.
    return { ip: null, userAgent: null };
  }
}

/** Never log anything that could contain a plaintext secret. */
function sanitiseDetails(details: Record<string, unknown> | null | undefined) {
  if (!details) return null;
  const blocked = ['key', 'apikey', 'apiKey', 'password', 'secret', 'token', 'encryptedKey', 'iv', 'tag'];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (blocked.includes(k)) {
      out[k] = typeof v === 'string' ? '«redacted»' : '[redacted]';
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function logAdminAction(ctx: AuditContext): Promise<void> {
  try {
    const { ip, userAgent } = await requestFingerprint();
    await db.insert(adminAuditLog).values({
      adminId: ctx.adminId,
      adminEmail: ctx.adminEmail,
      action: ctx.action,
      targetType: ctx.targetType ?? null,
      targetId: ctx.targetId ?? null,
      details: (sanitiseDetails(ctx.details) ?? null) as never,
      ip,
      userAgent,
    });
  } catch (error) {
    console.error('[audit] failed to write audit entry', {
      action: ctx.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Convenience wrapper that also fills the actor from a session user object. */
export async function auditUserAction(
  actor: { id: string; email?: string | null } | null,
  entry: Omit<AuditContext, 'adminId' | 'adminEmail'>,
): Promise<void> {
  await logAdminAction({
    adminId: actor?.id ?? null,
    adminEmail: actor?.email ?? null,
    ...entry,
  });
}

export async function getAuditTrail(options: { action?: string; adminId?: string; limit?: number } = {}) {
  return listAuditLog(options);
}

export { adminAuditLog };
