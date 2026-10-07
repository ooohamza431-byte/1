import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from './client';
import {
  chats,
  generatedImages,
  messages,
  projects,
  usageStats,
  userApiKeys,
  users,
  visionLibrary,
  type NewUser,
  type ProjectFile,
  type User,
} from './schema';
import { decryptSecret, encryptSecret, maskKey, safeDecryptSecret } from '@/lib/crypto/encrypt';
import type { Role } from '@/lib/constants';

/* -------------------------------------------------------------------------- */
/*  Users                                                                     */
/* -------------------------------------------------------------------------- */

function ownerEmail(): string | null {
  const raw = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Create-on-first-login for OAuth. Also performs the two role rules that must
 * never be done client-side:
 *   1. `OWNER_EMAIL` is promoted to `owner` (idempotent).
 *   2. Existing users keep whatever role an admin granted them.
 */
export async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(email);
  const owner = ownerEmail();
  const shouldBeOwner = owner !== null && owner === email;

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        name: input.name ?? existing.name,
        image: input.image ?? existing.image,
        role: shouldBeOwner && existing.role !== 'owner' ? 'owner' : existing.role,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name ?? email.split('@')[0],
      image: input.image ?? null,
      role: shouldBeOwner ? 'owner' : 'user',
    })
    .returning();
  return created;
}

export async function createCredentialUser(input: {
  email: string;
  password: string;
  name?: string;
  role?: Role;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const owner = ownerEmail();
  const role: Role = input.role ?? (owner === email ? 'owner' : 'user');
  const passwordHash = await bcrypt.hash(input.password, 12);

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: input.name ?? email.split('@')[0],
      passwordHash,
      role,
    })
    .returning();
  return created;
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function touchLastActive(userId: string): Promise<void> {
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<NewUser, 'name' | 'image'>>,
): Promise<User | null> {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Chats & messages                                                          */
/* -------------------------------------------------------------------------- */

export async function listChats(userId: string, limit = 100) {
  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.pinned), desc(chats.updatedAt))
    .limit(limit);
}

export async function getChat(userId: string, chatId: string) {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createChat(input: {
  userId: string;
  title?: string;
  model?: string | null;
  provider?: string | null;
  mode?: 'chat' | 'build';
}) {
  const [row] = await db
    .insert(chats)
    .values({
      userId: input.userId,
      title: input.title?.slice(0, 120) || 'New chat',
      model: input.model ?? null,
      provider: input.provider ?? null,
      mode: input.mode ?? 'chat',
    })
    .returning();
  return row;
}

export async function updateChat(
  userId: string,
  chatId: string,
  patch: Partial<{ title: string; model: string | null; provider: string | null; pinned: boolean; mode: 'chat' | 'build' }>,
) {
  const [row] = await db
    .update(chats)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteChat(userId: string, chatId: string) {
  const [row] = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });
  return row ?? null;
}

export async function listMessages(chatId: string, limit = 500) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function addMessage(input: {
  chatId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  agent?: string | null;
  thinking?: string | null;
  provider?: string | null;
  model?: string | null;
  tokens?: number;
  cost?: number;
  latencyMs?: number | null;
}) {
  const [row] = await db
    .insert(messages)
    .values({
      chatId: input.chatId,
      role: input.role,
      content: input.content,
      agent: input.agent ?? null,
      thinking: input.thinking ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      tokens: input.tokens ?? 0,
      cost: input.cost ?? 0,
      latencyMs: input.latencyMs ?? null,
    })
    .returning();
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, input.chatId));
  return row;
}

export async function flagMessage(messageId: string, reason: string) {
  const [row] = await db
    .update(messages)
    .set({ flagged: true, flagReason: reason })
    .where(eq(messages.id, messageId))
    .returning({ id: messages.id });
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Projects                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveProject(input: {
  chatId: string;
  files: ProjectFile[];
  score?: number | null;
  rounds?: number;
  summary?: string | null;
  entryFile?: string | null;
}) {
  const [row] = await db
    .insert(projects)
    .values({
      chatId: input.chatId,
      files: input.files,
      score: input.score ?? null,
      rounds: input.rounds ?? 0,
      summary: input.summary ?? null,
      entryFile: input.entryFile ?? null,
    })
    .returning();
  return row;
}

export async function getLatestProject(chatId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.chatId, chatId))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/*  User API keys                                                             */
/* -------------------------------------------------------------------------- */

export async function listUserKeys(userId: string) {
  const rows = await db
    .select({
      id: userApiKeys.id,
      provider: userApiKeys.provider,
      label: userApiKeys.label,
      hint: userApiKeys.hint,
      status: userApiKeys.status,
      lastError: userApiKeys.lastError,
      lastUsedAt: userApiKeys.lastUsedAt,
      createdAt: userApiKeys.createdAt,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
    .orderBy(asc(userApiKeys.provider));
  // Note: the ciphertext/iv/tag columns are deliberately not selected — masked
  // values are all the browser is ever allowed to see.
  return rows;
}

export async function upsertUserKey(input: {
  userId: string;
  provider: string;
  key: string;
  label?: string | null;
}) {
  const { encryptedKey, iv, tag } = encryptSecret(input.key);
  const hint = maskKey(input.key);

  const [row] = await db
    .insert(userApiKeys)
    .values({
      userId: input.userId,
      provider: input.provider,
      encryptedKey,
      iv,
      tag,
      label: input.label ?? null,
      hint,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [userApiKeys.userId, userApiKeys.provider],
      set: {
        encryptedKey,
        iv,
        tag,
        label: input.label ?? null,
        hint,
        status: 'active',
        lastError: null,
      },
    })
    .returning({ id: userApiKeys.id, provider: userApiKeys.provider, hint: userApiKeys.hint });
  return row;
}

export async function setUserKeyStatus(
  userId: string,
  provider: string,
  status: 'active' | 'invalid' | 'cooling' | 'exhausted',
  lastError?: string | null,
) {
  await db
    .update(userApiKeys)
    .set({ status, lastError: lastError ?? null })
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
}

export async function deleteUserKey(userId: string, id: string) {
  const [row] = await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)))
    .returning({ id: userApiKeys.id });
  return row ?? null;
}

/** Decrypt a user's key for a provider. Returns null when absent/undecryptable. */
export async function getDecryptedUserKey(
  userId: string,
  provider: string,
): Promise<{ id: string; key: string } | null> {
  const [row] = await db
    .select({ id: userApiKeys.id, encryptedKey: userApiKeys.encryptedKey, iv: userApiKeys.iv, tag: userApiKeys.tag })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
    .limit(1);
  if (!row) return null;
  const key = safeDecryptSecret(row);
  return key ? { id: row.id, key } : null;
}

export async function markUserKeyUsed(userId: string, provider: string) {
  await db
    .update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
}

/* -------------------------------------------------------------------------- */
/*  Images & vision                                                           */
/* -------------------------------------------------------------------------- */

export async function saveGeneratedImage(input: {
  userId: string;
  prompt: string;
  url: string;
  model: string;
  width: number;
  height: number;
  seed?: number | null;
}) {
  const [row] = await db.insert(generatedImages).values({ ...input, seed: input.seed ?? null }).returning();
  return row;
}

export async function listGeneratedImages(userId: string, limit = 20) {
  return db
    .select()
    .from(generatedImages)
    .where(eq(generatedImages.userId, userId))
    .orderBy(desc(generatedImages.createdAt))
    .limit(limit);
}

export async function deleteGeneratedImage(userId: string, id: string) {
  const [row] = await db
    .delete(generatedImages)
    .where(and(eq(generatedImages.id, id), eq(generatedImages.userId, userId)))
    .returning({ id: generatedImages.id });
  return row ?? null;
}

export async function saveVisionItem(input: {
  userId: string;
  thumb?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  analysis?: string | null;
  ocr?: string | null;
}) {
  const [row] = await db.insert(visionLibrary).values(input).returning();
  return row;
}

export async function listVisionItems(userId: string, limit = 50) {
  return db
    .select()
    .from(visionLibrary)
    .where(eq(visionLibrary.userId, userId))
    .orderBy(desc(visionLibrary.createdAt))
    .limit(limit);
}

export async function deleteVisionItem(userId: string, id: string) {
  const [row] = await db
    .delete(visionLibrary)
    .where(and(eq(visionLibrary.id, id), eq(visionLibrary.userId, userId)))
    .returning({ id: visionLibrary.id });
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Usage statistics                                                          */
/* -------------------------------------------------------------------------- */

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordUsage(input: {
  userId: string;
  provider: string;
  model: string;
  tokens?: number;
  cost?: number;
  requests?: number;
  errors?: number;
  billingSource?: 'user' | 'server';
}) {
  const tokens = Math.max(0, Math.round(input.tokens ?? 0));
  const cost = Math.max(0, input.cost ?? 0);
  const requests = input.requests ?? 1;
  const errors = input.errors ?? 0;
  const billingSource = input.billingSource ?? 'user';

  await db
    .insert(usageStats)
    .values({
      userId: input.userId,
      date: todayKey(),
      provider: input.provider,
      model: input.model || 'unknown',
      tokens,
      cost,
      requests,
      errors,
      billingSource,
    })
    .onConflictDoUpdate({
      target: [usageStats.userId, usageStats.date, usageStats.provider, usageStats.model, usageStats.billingSource],
      set: {
        tokens: sql`${usageStats.tokens} + ${tokens}`,
        cost: sql`${usageStats.cost} + ${cost}`,
        requests: sql`${usageStats.requests} + ${requests}`,
        errors: sql`${usageStats.errors} + ${errors}`,
      },
    });
}

export async function getUsageToday(userId: string) {
  const [row] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
    })
    .from(usageStats)
    .where(and(eq(usageStats.userId, userId), eq(usageStats.date, todayKey())));
  return row ?? { tokens: 0, cost: 0, requests: 0 };
}

export async function getUserTotals(userId: string) {
  const [row] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${usageStats.tokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${usageStats.cost}), 0)::float`,
      requests: sql<number>`coalesce(sum(${usageStats.requests}), 0)::int`,
      errors: sql<number>`coalesce(sum(${usageStats.errors}), 0)::int`,
    })
    .from(usageStats)
    .where(eq(usageStats.userId, userId));

  return row ?? { tokens: 0, cost: 0, requests: 0, errors: 0 };
}

/**
 * Lifetime counts for the dashboard. Three separate indexed counts beat one
 * wide query here: `chats` and `usage_stats` are both large, and joining them
 * would multiply rows (and inflate the sums) for no benefit.
 */
export async function getUserEntityCounts(userId: string) {
  const [chats_, projects_, images_] = await Promise.all([
    db.$count(chats, eq(chats.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .innerJoin(chats, eq(projects.chatId, chats.id))
      .where(eq(chats.userId, userId)),
    db.$count(generatedImages, eq(generatedImages.userId, userId)),
  ]);

  return {
    chats: chats_,
    projects: projects_[0]?.count ?? 0,
    images: images_,
  };
}

export async function countBuildsToday(userId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chats)
    .where(and(eq(chats.userId, userId), eq(chats.mode, 'build'), gte(chats.createdAt, since)));
  return row?.count ?? 0;
}

export async function countImagesToday(userId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generatedImages)
    .where(and(eq(generatedImages.userId, userId), gte(generatedImages.createdAt, since)));
  return row?.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Moderation helpers                                                        */
/* -------------------------------------------------------------------------- */

export async function getRecentMessagesForUsers(userIds: string[], limit = 200) {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(messages)
    .where(inArray(messages.chatId, db.select({ id: chats.id }).from(chats).where(inArray(chats.userId, userIds))))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function pruneOldUsage(daysToKeep = 365) {
  const cutoff = new Date(Date.now() - daysToKeep * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .delete(usageStats)
    .where(lt(usageStats.date, cutoff))
    .returning({ id: usageStats.id });
  return rows.length;
}

/** Chats that are not empty — used by the impersonation read-only view. */
/**
 * Chat list with message and project counts, for the sidebar and history page.
 *
 * The counts come from two grouped queries merged in memory rather than from
 * correlated subqueries in the select list. A raw `sql` template renders the
 * referenced columns **unqualified** (`where "chat_id" = "id"`), and Postgres
 * then resolves both sides inside the inner table — which silently returns 0 for
 * every row instead of erroring. Two indexed `count(*) … group by` passes are
 * just as fast and cannot lie.
 */
export async function listChatsWithCounts(userId: string, limit = 50) {
  const rows = await db
    .select({
      id: chats.id,
      title: chats.title,
      model: chats.model,
      mode: chats.mode,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
    })
    .from(chats)
    .where(and(eq(chats.userId, userId), ne(chats.title, '')))
    .orderBy(desc(chats.updatedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [messageRows, projectRows] = await Promise.all([
    db
      .select({ chatId: messages.chatId, count: sql<number>`count(*)::int` })
      .from(messages)
      .where(inArray(messages.chatId, ids))
      .groupBy(messages.chatId),
    db
      .select({ chatId: projects.chatId, count: sql<number>`count(*)::int` })
      .from(projects)
      .where(inArray(projects.chatId, ids))
      .groupBy(projects.chatId),
  ]);

  const messageCounts = new Map(messageRows.map((row) => [row.chatId, row.count]));
  const projectCounts = new Map(projectRows.map((row) => [row.chatId, row.count]));

  return rows.map((row) => ({
    ...row,
    messageCount: messageCounts.get(row.id) ?? 0,
    projectCount: projectCounts.get(row.id) ?? 0,
  }));
}

export { decryptSecret, encryptSecret, maskKey };
