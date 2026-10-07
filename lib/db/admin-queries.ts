import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './client';
import {
  adminAuditLog,
  bannedPatterns,
  chats,
  customProviders,
  featureFlags,
  generatedImages,
  messages,
  projects,
  providerConfig,
  providerHealth,
  serverApiKeys,
  systemSettings,
  usageStats,
  userApiKeys,
  users,
  visionLibrary,
  type BannedPattern,
  type ProviderConfigRow,
  type ServerApiKey,
} from './schema';
import { encryptSecret, maskKey, safeDecryptSecret } from '@/lib/crypto/encrypt';
import type { Role } from '@/lib/constants';
import { DEFAULT_FEATURES, FEATURE_FLAGS, SYSTEM_DEFAULTS, type FeatureFlagKey } from '@/lib/constants';

/* -------------------------------------------------------------------------- */
/*  Feature flags                                                             */
/* -------------------------------------------------------------------------- */

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = await db.select().from(featureFlags);
  const merged: Record<string, boolean> = { ...DEFAULT_FEATURES };
  for (const row of rows) {
    merged[row.key] = row.enabled;
  }
  return merged;
}

export async function isFeatureEnabled(key: FeatureFlagKey | string, fallback = true): Promise<boolean> {
  const [row] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  if (!row) return DEFAULT_FEATURES[key as FeatureFlagKey] ?? fallback;
  return row.enabled;
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  adminId: string,
  value?: unknown,
): Promise<void> {
  await db
    .insert(featureFlags)
    .values({ key, enabled, value: (value ?? null) as never, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { enabled, value: (value ?? null) as never, updatedBy: adminId, updatedAt: new Date() },
    });
}

/** Seeds any flag that has never been written, so the panel always lists them all. */
export async function ensureFeatureFlags(): Promise<void> {
  const rows = await db.select({ key: featureFlags.key }).from(featureFlags);
  const present = new Set(rows.map((r) => r.key));
  const missing = FEATURE_FLAGS.filter((key) => !present.has(key));
  if (missing.length === 0) return;
  await db
    .insert(featureFlags)
    .values(missing.map((key) => ({ key, enabled: DEFAULT_FEATURES[key] })))
    .onConflictDoNothing();
}

/* -------------------------------------------------------------------------- */
/*  System settings                                                           */
/* -------------------------------------------------------------------------- */

export async function getSystemSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(systemSettings);
  const merged: Record<string, unknown> = { ...SYSTEM_DEFAULTS };
  for (const row of rows) merged[row.key] = row.value;
  return merged;
}

export async function setSystemSetting(key: string, value: unknown, adminId: string): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value: value as never, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: value as never, updatedBy: adminId, updatedAt: new Date() },
    });
}

/* -------------------------------------------------------------------------- */
/*  Server API keys                                                           */
/* -------------------------------------------------------------------------- */

export type ServerKeySummary = {
  id: string;
  provider: string;
  label: string | null;
  hint: string | null;
  priority: number;
  enabled: boolean;
  quota: number | null;
  used: number;
  lastTestedAt: Date | null;
  testStatus: string | null;
  testLatencyMs: number | null;
  lastError: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function listServerKeys(provider?: string): Promise<ServerKeySummary[]> {
  const base = db
    .select({
      id: serverApiKeys.id,
      provider: serverApiKeys.provider,
      label: serverApiKeys.label,
      hint: serverApiKeys.hint,
      priority: serverApiKeys.priority,
      enabled: serverApiKeys.enabled,
      quota: serverApiKeys.quota,
      used: serverApiKeys.used,
      lastTestedAt: serverApiKeys.lastTestedAt,
      testStatus: serverApiKeys.testStatus,
      testLatencyMs: serverApiKeys.testLatencyMs,
      lastError: serverApiKeys.lastError,
      lastUsedAt: serverApiKeys.lastUsedAt,
      createdAt: serverApiKeys.createdAt,
    })
    .from(serverApiKeys);

  const rows = provider
    ? await base.where(eq(serverApiKeys.provider, provider)).orderBy(asc(serverApiKeys.priority))
    : await base.orderBy(asc(serverApiKeys.provider), asc(serverApiKeys.priority));
  return rows;
}

export async function createServerKey(input: {
  provider: string;
  key: string;
  label?: string | null;
  priority?: number;
  quota?: number | null;
  enabled?: boolean;
  createdBy: string;
}): Promise<{ id: string }> {
  const { encryptedKey, iv, tag } = encryptSecret(input.key);
  const [row] = await db
    .insert(serverApiKeys)
    .values({
      provider: input.provider,
      encryptedKey,
      iv,
      tag,
      label: input.label ?? null,
      hint: maskKey(input.key),
      priority: input.priority ?? 100,
      quota: input.quota ?? null,
      enabled: input.enabled ?? true,
      createdBy: input.createdBy,
    })
    .returning({ id: serverApiKeys.id });
  return row;
}

export async function updateServerKey(
  id: string,
  patch: Partial<{
    label: string | null;
    priority: number;
    enabled: boolean;
    quota: number | null;
    key: string;
  }>,
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (patch.quota !== undefined) set.quota = patch.quota;
  if (patch.key) {
    const { encryptedKey, iv, tag } = encryptSecret(patch.key);
    set.encryptedKey = encryptedKey;
    set.iv = iv;
    set.tag = tag;
    set.hint = maskKey(patch.key);
    set.testStatus = null;
    set.lastError = null;
  }
  if (Object.keys(set).length === 0) return;
  await db.update(serverApiKeys).set(set).where(eq(serverApiKeys.id, id));
}

export async function deleteServerKey(id: string): Promise<void> {
  await db.delete(serverApiKeys).where(eq(serverApiKeys.id, id));
}

export async function recordServerKeyTest(
  id: string,
  ok: boolean,
  latencyMs: number,
  error?: string | null,
): Promise<void> {
  await db
    .update(serverApiKeys)
    .set({
      lastTestedAt: new Date(),
      testStatus: ok ? 'ok' : 'failed',
      testLatencyMs: Math.round(latencyMs),
      lastError: ok ? null : (error ?? 'unknown error'),
    })
    .where(eq(serverApiKeys.id, id));
}

export async function bumpServerKeyUsage(id: string, tokens = 0): Promise<void> {
  await db
    .update(serverApiKeys)
    .set({ used: sql`${serverApiKeys.used} + ${Math.max(0, Math.round(tokens))}`, lastUsedAt: new Date() })
    .where(eq(serverApiKeys.id, id));
}

/**
 * All enabled server keys for a provider, ordered by priority, decrypted and
 * filtered by quota. Returns an empty array when the provider has no usable key.
 *
 * `DEFAULT_<PROVIDER>_KEY` env vars are appended as the lowest-priority
 * fallback, which lets an operator bootstrap an instance before touching the
 * admin panel.
 */
export async function getServerKeysForProvider(
  provider: string,
): Promise<Array<{ id: string; key: string; label: string | null; priority: number }>> {
  const rows = await db
    .select()
    .from(serverApiKeys)
    .where(and(eq(serverApiKeys.provider, provider), eq(serverApiKeys.enabled, true)))
    .orderBy(asc(serverApiKeys.priority));

  const usable: Array<{ id: string; key: string; label: string | null; priority: number }> = [];
  for (const row of rows) {
    if (row.quota !== null && row.used >= row.quota) continue;
    const key = safeDecryptSecret(row);
    if (!key) continue;
    usable.push({ id: row.id, key, label: row.label, priority: row.priority });
  }

  const envKey = process.env[`DEFAULT_${provider.toUpperCase()}_KEY`]?.trim();
  if (envKey) {
    usable.push({ id: `env:${provider}`, key: envKey, label: 'environment variable', priority: 9_999 });
  }

  return usable;
}

export async function getServerKeyCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      provider: serverApiKeys.provider,
      count: sql<number>`count(*)::int`,
    })
    .from(serverApiKeys)
    .where(eq(serverApiKeys.enabled, true))
    .groupBy(serverApiKeys.provider);
  const out: Record<string, number> = {};
  for (const row of rows) out[row.provider] = row.count;
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Provider configuration                                                    */
/* -------------------------------------------------------------------------- */

export async function listProviderConfig(): Promise<ProviderConfigRow[]> {
  return db.select().from(providerConfig).orderBy(asc(providerConfig.chainOrder));
}

export async function getProviderConfig(provider: string): Promise<ProviderConfigRow | null> {
  const [row] = await db.select().from(providerConfig).where(eq(providerConfig.provider, provider)).limit(1);
  return row ?? null;
}

export async function upsertProviderConfig(
  provider: string,
  patch: Partial<{
    enabled: boolean;
    defaultModel: string | null;
    rateLimit: number | null;
    chainOrder: number;
    customBase: string | null;
    agentModels: Record<string, string> | null;
    notes: string | null;
  }>,
): Promise<void> {
  const existing = await getProviderConfig(provider);
  if (!existing) {
    await db.insert(providerConfig).values({
      provider,
      enabled: patch.enabled ?? true,
      defaultModel: patch.defaultModel ?? null,
      rateLimit: patch.rateLimit ?? null,
      chainOrder: patch.chainOrder ?? 100,
      customBase: patch.customBase ?? null,
      agentModels: (patch.agentModels ?? null) as never,
      notes: patch.notes ?? null,
    });
    return;
  }
  await db
    .update(providerConfig)
    .set({
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.defaultModel !== undefined ? { defaultModel: patch.defaultModel } : {}),
      ...(patch.rateLimit !== undefined ? { rateLimit: patch.rateLimit } : {}),
      ...(patch.chainOrder !== undefined ? { chainOrder: patch.chainOrder } : {}),
      ...(patch.customBase !== undefined ? { customBase: patch.customBase } : {}),
      ...(patch.agentModels !== undefined ? { agentModels: patch.agentModels as never } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(providerConfig.provider, provider));
}

export async function reorderProviderChain(providers: string[]): Promise<void> {
  for (let i = 0; i < providers.length; i += 1) {
    await upsertProviderConfig(providers[i], { chainOrder: (i + 1) * 10 });
  }
}

/* -------------------------------------------------------------------------- */
/*  Custom providers                                                          */
/* -------------------------------------------------------------------------- */

export async function listCustomProviders(includeKey = false) {
  const rows = await db.select().from(customProviders).orderBy(asc(customProviders.chainOrder));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    defaultModel: row.defaultModel,
    models: (row.models as string[] | null) ?? [],
    enabled: row.enabled,
    chainOrder: row.chainOrder,
    createdAt: row.createdAt,
    hint: maskKey(includeKey ? safeDecryptSecret(row) : null),
  }));
}

export async function getDecryptedCustomProvider(id: string) {
  const [row] = await db.select().from(customProviders).where(eq(customProviders.id, id)).limit(1);
  if (!row) return null;
  const key = safeDecryptSecret(row);
  if (!key) return null;
  return { ...row, key };
}

export async function createCustomProvider(input: {
  name: string;
  baseUrl: string;
  key: string;
  defaultModel: string;
  models?: string[];
  chainOrder?: number;
}) {
  const { encryptedKey, iv, tag } = encryptSecret(input.key);
  const [row] = await db
    .insert(customProviders)
    .values({
      name: input.name,
      baseUrl: input.baseUrl,
      encryptedKey,
      iv,
      tag,
      defaultModel: input.defaultModel,
      models: (input.models ?? []) as never,
      chainOrder: input.chainOrder ?? 100,
    })
    .returning({ id: customProviders.id });
  return row;
}

export async function updateCustomProvider(
  id: string,
  patch: Partial<{ name: string; baseUrl: string; defaultModel: string; enabled: boolean; chainOrder: number; key: string }>,
) {
  const set: Record<string, unknown> = {};
  for (const field of ['name', 'baseUrl', 'defaultModel', 'enabled', 'chainOrder'] as const) {
    if (patch[field] !== undefined) set[field] = patch[field];
  }
  if (patch.key) {
    const { encryptedKey, iv, tag } = encryptSecret(patch.key);
    Object.assign(set, { encryptedKey, iv, tag });
  }
  if (Object.keys(set).length === 0) return;
  await db.update(customProviders).set(set).where(eq(customProviders.id, id));
}

export async function deleteCustomProvider(id: string) {
  await db.delete(customProviders).where(eq(customProviders.id, id));
}

/* -------------------------------------------------------------------------- */
/*  User administration                                                       */
/* -------------------------------------------------------------------------- */

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  banned: boolean;
  banReason: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  maxTokensPerDay: number | null;
  maxBuildsPerDay: number | null;
  maxImagesPerDay: number | null;
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  chatCount: number;
};

/**
 * Users plus their lifetime usage, for the admin table.
 *
 * The aggregates are fetched as four grouped queries and merged in memory, NOT
 * as correlated subqueries in the select list: a raw `sql` template renders its
 * column references unqualified, so `where "user_id" = "id"` resolves entirely
 * inside the inner table and every row comes back as 0 — a wrong number with no
 * error attached, which is worse than a crash.
 */
export async function listUsersWithStats(search?: string): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
      banned: users.banned,
      banReason: users.banReason,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      maxTokensPerDay: users.maxTokensPerDay,
      maxBuildsPerDay: users.maxBuildsPerDay,
      maxImagesPerDay: users.maxImagesPerDay,
    })
    .from(users)
    .where(
      search && search.trim().length > 0
        ? or(ilike(users.email, `%${search.trim()}%`), ilike(users.name, `%${search.trim()}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(500);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [usageRows, chatRows] = await Promise.all([
    db
      .select({
        userId: usageStats.userId,
        tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
        cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
        requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      })
      .from(usageStats)
      .where(inArray(usageStats.userId, ids))
      .groupBy(usageStats.userId),
    db
      .select({ userId: chats.userId, count: sql<number>`count(*)::int` })
      .from(chats)
      .where(inArray(chats.userId, ids))
      .groupBy(chats.userId),
  ]);

  const usageByUser = new Map(usageRows.map((row) => [row.userId, row]));
  const chatsByUser = new Map(chatRows.map((row) => [row.userId, row.count]));

  return rows.map((row) => {
    const usage = usageByUser.get(row.id);
    return {
      ...row,
      totalTokens: usage?.tokens ?? 0,
      totalCost: usage?.cost ?? 0,
      totalRequests: usage?.requests ?? 0,
      chatCount: chatsByUser.get(row.id) ?? 0,
    };
  });
}

export async function setUserRole(userId: string, role: Role) {
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function setUserBanned(userId: string, banned: boolean, reason?: string | null) {
  await db
    .update(users)
    .set({ banned, banReason: banned ? (reason ?? null) : null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function setUserQuotas(
  userId: string,
  quotas: Partial<{ maxTokensPerDay: number | null; maxBuildsPerDay: number | null; maxImagesPerDay: number | null }>,
) {
  await db
    .update(users)
    .set({ ...quotas, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function resetUserRateLimit(userId: string) {
  await db.update(users).set({ rateLimitResetAt: new Date() }).where(eq(users.id, userId));
}

/** Cascade delete: chats, messages, projects, keys, images, vision and usage. */
export async function deleteUserCompletely(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

export async function getAdminUserDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [chatRows, keyRows, imageCount] = await Promise.all([
    db
      .select({ id: chats.id, title: chats.title, mode: chats.mode, updatedAt: chats.updatedAt, model: chats.model })
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.updatedAt))
      .limit(50),
    db
      .select({ id: userApiKeys.id, provider: userApiKeys.provider, hint: userApiKeys.hint, status: userApiKeys.status })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(generatedImages)
      .where(eq(generatedImages.userId, userId)),
  ]);
  return { user, chats: chatRows, keys: keyRows, imageCount: imageCount[0]?.count ?? 0 };
}

/* -------------------------------------------------------------------------- */
/*  Analytics                                                                 */
/* -------------------------------------------------------------------------- */

export type AnalyticsRange = { since: Date; label: string };

export function resolveRange(days: number): AnalyticsRange {
  const since = new Date(Date.now() - days * 86_400_000);
  return { since, label: `${days}d` };
}

export async function getOverviewStats() {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const startOfToday = new Date().toISOString().slice(0, 10);

  const [[totalUsers], [active24h], [active7d], [active30d], [totals], [todayTotals], [flagged], [pendingKeys]] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.lastActiveAt, dayAgo)),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.lastActiveAt, weekAgo)),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.lastActiveAt, monthAgo)),
      db
        .select({
          tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
          cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
          requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
          errors: sql<number>`coalesce(sum(${usageStats.errors}), 0)::int`,
        })
        .from(usageStats),
      db
        .select({
          tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
          cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
          requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
        })
        .from(usageStats)
        .where(eq(usageStats.date, startOfToday)),
      db.select({ count: sql<number>`count(*)::int` }).from(messages).where(eq(messages.flagged, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(serverApiKeys).where(eq(serverApiKeys.enabled, true)),
    ]);

  return {
    totalUsers: totalUsers?.count ?? 0,
    active24h: active24h?.count ?? 0,
    active7d: active7d?.count ?? 0,
    active30d: active30d?.count ?? 0,
    totalTokens: totals?.tokens ?? 0,
    totalCost: totals?.cost ?? 0,
    totalRequests: totals?.requests ?? 0,
    totalErrors: totals?.errors ?? 0,
    tokensToday: todayTotals?.tokens ?? 0,
    costToday: todayTotals?.cost ?? 0,
    requestsToday: todayTotals?.requests ?? 0,
    flaggedMessages: flagged?.count ?? 0,
    enabledServerKeys: pendingKeys?.count ?? 0,
  };
}

export async function getProviderBreakdown(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({
      provider: usageStats.provider,
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      errors: sql<number>`coalesce(sum(${usageStats.errors}), 0)::int`,
    })
    .from(usageStats)
    .where(gte(usageStats.date, since))
    .groupBy(usageStats.provider)
    .orderBy(desc(sql`sum(${usageStats.requests})`));
}

export async function getTopModels(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({
      model: usageStats.model,
      provider: usageStats.provider,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
    })
    .from(usageStats)
    .where(gte(usageStats.date, since))
    .groupBy(usageStats.model, usageStats.provider)
    .orderBy(desc(sql`sum(${usageStats.requests})`))
    .limit(limit);
}

export async function getDailySeries(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({
      date: usageStats.date,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
    })
    .from(usageStats)
    .where(gte(usageStats.date, since))
    .groupBy(usageStats.date)
    .orderBy(asc(usageStats.date));
}

export async function getCostPerUser(days = 30, limit = 100) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
    })
    .from(usageStats)
    .innerJoin(users, eq(users.id, usageStats.userId))
    .where(gte(usageStats.date, since))
    .groupBy(users.id, users.email, users.name)
    .orderBy(desc(sql`sum(${usageStats.cost})`))
    .limit(limit);
}

export async function getBillingSplit(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({
      billingSource: usageStats.billingSource,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
    })
    .from(usageStats)
    .where(gte(usageStats.date, since))
    .groupBy(usageStats.billingSource);
}

/* -------------------------------------------------------------------------- */
/*  Provider health                                                           */
/* -------------------------------------------------------------------------- */

export async function upsertProviderHealth(input: {
  provider: string;
  ok: boolean;
  latencyMs?: number;
  error?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(providerHealth)
    .where(eq(providerHealth.provider, input.provider))
    .limit(1);

  const samples: number[] = Array.isArray(existing?.latency)
    ? (existing?.latency as number[]).slice(-49)
    : [];
  if (typeof input.latencyMs === 'number' && input.latencyMs > 0) samples.push(Math.round(input.latencyMs));
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number) =>
    sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const latency = [pick(0.5), pick(0.95), pick(0.99)];

  const failures = input.ok ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
  const status = input.ok
    ? 'healthy'
    : failures >= 3
      ? 'down'
      : 'degraded';

  const values = {
    provider: input.provider,
    status: status as 'healthy' | 'degraded' | 'down' | 'unknown',
    consecutiveFailures: failures,
    requestCount: (existing?.requestCount ?? 0) + 1,
    errorCount: (existing?.errorCount ?? 0) + (input.ok ? 0 : 1),
    latency: latency as never,
    lastLatencyMs: input.latencyMs ? Math.round(input.latencyMs) : (existing?.lastLatencyMs ?? null),
    lastOkAt: input.ok ? new Date() : (existing?.lastOkAt ?? null),
    lastErrorAt: input.ok ? (existing?.lastErrorAt ?? null) : new Date(),
    lastError: input.ok ? null : (input.error ?? 'unknown error'),
    updatedAt: new Date(),
  };

  await db
    .insert(providerHealth)
    .values(values)
    .onConflictDoUpdate({ target: providerHealth.provider, set: values });
}

export async function listProviderHealth() {
  return db.select().from(providerHealth).orderBy(asc(providerHealth.provider));
}

/* -------------------------------------------------------------------------- */
/*  Moderation                                                                */
/* -------------------------------------------------------------------------- */

export async function listBannedPatterns(): Promise<BannedPattern[]> {
  return db.select().from(bannedPatterns).orderBy(desc(bannedPatterns.createdAt));
}

export async function createBannedPattern(input: {
  pattern: string;
  reason?: string | null;
  isLiteral?: boolean;
  createdBy: string;
}) {
  const [row] = await db
    .insert(bannedPatterns)
    .values({
      pattern: input.pattern,
      reason: input.reason ?? null,
      isLiteral: input.isLiteral ?? false,
      createdBy: input.createdBy,
    })
    .returning({ id: bannedPatterns.id });
  return row;
}

export async function deleteBannedPattern(id: string) {
  await db.delete(bannedPatterns).where(eq(bannedPatterns.id, id));
}

export async function listMessagesForModeration(input: {
  userId?: string;
  onlyFlagged?: boolean;
  search?: string;
  limit?: number;
}) {
  const limit = input.limit ?? 200;
  const conditions = [];
  if (input.userId) conditions.push(eq(chats.userId, input.userId));
  if (input.onlyFlagged) conditions.push(eq(messages.flagged, true));
  if (input.search && input.search.trim()) conditions.push(ilike(messages.content, `%${input.search.trim()}%`));

  return db
    .select({
      id: messages.id,
      chatId: messages.chatId,
      chatTitle: chats.title,
      userId: chats.userId,
      userEmail: users.email,
      role: messages.role,
      agent: messages.agent,
      content: messages.content,
      flagged: messages.flagged,
      flagReason: messages.flagReason,
      model: messages.model,
      provider: messages.provider,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .innerJoin(users, eq(users.id, chats.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

/** Full export payload for the moderation CSV / backup JSON. */
export async function exportChatLogs(limit = 5000) {
  return db
    .select({
      messageId: messages.id,
      chatId: messages.chatId,
      chatTitle: chats.title,
      userEmail: users.email,
      role: messages.role,
      agent: messages.agent,
      model: messages.model,
      provider: messages.provider,
      tokens: messages.tokens,
      cost: messages.cost,
      flagged: messages.flagged,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(chats, eq(chats.id, messages.chatId))
    .innerJoin(users, eq(users.id, chats.userId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

/* -------------------------------------------------------------------------- */
/*  Audit log                                                                 */
/* -------------------------------------------------------------------------- */

export async function listAuditLog(input: { action?: string; adminId?: string; limit?: number } = {}) {
  const conditions = [];
  if (input.action) conditions.push(eq(adminAuditLog.action, input.action));
  if (input.adminId) conditions.push(eq(adminAuditLog.adminId, input.adminId));
  return db
    .select()
    .from(adminAuditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(input.limit ?? 200);
}

export async function getAuditActions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: adminAuditLog.action })
    .from(adminAuditLog)
    .orderBy(asc(adminAuditLog.action));
  return rows.map((r) => r.action);
}

/* -------------------------------------------------------------------------- */
/*  Backup / restore                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Structural export of every table. Secrets (user keys, server keys, custom
 * provider keys) are exported as ciphertext — restoring into an instance with a
 * different ENCRYPTION_KEY leaves those rows undecryptable rather than leaking
 * plaintext into a downloadable file.
 */
export async function exportDatabase() {
  const [
    userRows,
    keyRows,
    serverKeyRows,
    chatRows,
    messageRows,
    projectRows,
    imageRows,
    visionRows,
    usageRows,
    flagRows,
    providerRows,
    customRows,
    patternRows,
    healthRows,
    settingsRows,
    auditRows,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(userApiKeys),
    db.select().from(serverApiKeys),
    db.select().from(chats),
    db.select().from(messages).limit(20_000),
    db.select().from(projects).limit(5_000),
    db.select().from(generatedImages).limit(20_000),
    db.select().from(visionLibrary).limit(5_000),
    db.select().from(usageStats).limit(50_000),
    db.select().from(featureFlags),
    db.select().from(providerConfig),
    db.select().from(customProviders),
    db.select().from(bannedPatterns),
    db.select().from(providerHealth),
    db.select().from(systemSettings),
    db.select().from(adminAuditLog).limit(5_000),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1 as const,
    counts: {
      users: userRows.length,
      userApiKeys: keyRows.length,
      serverApiKeys: serverKeyRows.length,
      chats: chatRows.length,
      messages: messageRows.length,
      projects: projectRows.length,
      generatedImages: imageRows.length,
      visionLibrary: visionRows.length,
      usageStats: usageRows.length,
      featureFlags: flagRows.length,
      providerConfig: providerRows.length,
      customProviders: customRows.length,
      bannedPatterns: patternRows.length,
      providerHealth: healthRows.length,
      systemSettings: settingsRows.length,
      auditLog: auditRows.length,
    },
    data: {
      users: userRows,
      userApiKeys: keyRows,
      serverApiKeys: serverKeyRows,
      chats: chatRows,
      messages: messageRows,
      projects: projectRows,
      generatedImages: imageRows,
      visionLibrary: visionRows,
      usageStats: usageRows,
      featureFlags: flagRows,
      providerConfig: providerRows,
      customProviders: customRows,
      bannedPatterns: patternRows,
      providerHealth: healthRows,
      systemSettings: settingsRows,
      auditLog: auditRows,
    },
  };
}

/** Only ever used by scripts/seed.ts and the admin restore action. */
export async function countRows(table: 'users' | 'messages' | 'serverApiKeys'): Promise<number> {
  const map = { users, messages, serverApiKeys } as const;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(map[table]);
  return row?.count ?? 0;
}

export type ServerKeyRecord = ServerApiKey;
