import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/*  Enums                                                                     */
/* -------------------------------------------------------------------------- */

export const roleEnum = pgEnum('user_role', ['user', 'admin', 'owner']);
export const keyStatusEnum = pgEnum('key_status', ['active', 'invalid', 'cooling', 'exhausted']);
export const messageRoleEnum = pgEnum('message_role', ['system', 'user', 'assistant', 'tool']);
export const chatModeEnum = pgEnum('chat_mode', ['chat', 'build']);
export const healthEnum = pgEnum('provider_health_status', ['unknown', 'healthy', 'degraded', 'down']);

/* -------------------------------------------------------------------------- */
/*  Core auth tables                                                          */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    image: text('image'),
    role: roleEnum('role').notNull().default('user'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    /** bcrypt hash — only used by the credentials provider (admin/owner login). */
    passwordHash: text('password_hash'),
    /** Per-user daily quotas. NULL means "fall back to the system default". */
    maxTokensPerDay: integer('max_tokens_per_day'),
    maxBuildsPerDay: integer('max_builds_per_day'),
    maxImagesPerDay: integer('max_images_per_day'),
    /** Rate-limit window reset marker used by the admin "reset limit" action. */
    rateLimitResetAt: timestamp('rate_limit_reset_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
    lastActiveIdx: index('users_last_active_idx').on(t.lastActiveAt),
  }),
);

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({ userIdx: index('sessions_user_idx').on(t.userId) }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

/* -------------------------------------------------------------------------- */
/*  User-owned data                                                           */
/* -------------------------------------------------------------------------- */

export const userApiKeys = pgTable(
  'user_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    /** AES-256-GCM ciphertext (base64). Never leaves the server. */
    encryptedKey: text('encrypted_key').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    label: text('label'),
    /** Last 4 characters, stored for display so the plaintext need not be read. */
    hint: text('hint'),
    status: keyStatusEnum('status').notNull().default('active'),
    lastError: text('last_error'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userProviderIdx: uniqueIndex('user_api_keys_user_provider_unique').on(t.userId, t.provider),
    userIdx: index('user_api_keys_user_idx').on(t.userId),
  }),
);

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    model: text('model'),
    provider: text('provider'),
    mode: chatModeEnum('mode').notNull().default('chat'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUpdatedIdx: index('chats_user_updated_idx').on(t.userId, t.updatedAt),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    /** Agent that produced the message (planner/coder/...). */
    agent: text('agent'),
    /** Reasoning trace, kept separate from `content`. */
    thinking: text('thinking'),
    provider: text('provider'),
    model: text('model'),
    tokens: integer('tokens').notNull().default(0),
    cost: real('cost').notNull().default(0),
    latencyMs: integer('latency_ms'),
    flagged: boolean('flagged').notNull().default(false),
    flagReason: text('flag_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chatCreatedIdx: index('messages_chat_created_idx').on(t.chatId, t.createdAt),
    createdIdx: index('messages_created_idx').on(t.createdAt),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    /** [{ path, language, content, bytes }] */
    files: jsonb('files').notNull().default(sql`'[]'::jsonb`),
    score: real('score'),
    rounds: integer('rounds').notNull().default(0),
    summary: text('summary'),
    entryFile: text('entry_file'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ chatIdx: index('projects_chat_idx').on(t.chatId, t.createdAt) }),
);

export const visionLibrary = pgTable(
  'vision_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Small data-URL thumbnail so the library loads without the original blob. */
    thumb: text('thumb'),
    /** Original file name / mime for context. */
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    analysis: text('analysis'),
    ocr: text('ocr'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('vision_library_user_idx').on(t.userId, t.createdAt) }),
);

export const generatedImages = pgTable(
  'generated_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    url: text('url').notNull(),
    model: text('model').notNull().default('sana'),
    width: integer('width').notNull().default(1024),
    height: integer('height').notNull().default(1024),
    seed: integer('seed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('generated_images_user_idx').on(t.userId, t.createdAt) }),
);

/* -------------------------------------------------------------------------- */
/*  Admin-owned (shared, server-side) data                                    */
/* -------------------------------------------------------------------------- */

export const serverApiKeys = pgTable(
  'server_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    label: text('label'),
    hint: text('hint'),
    /** Lower number = tried first. */
    priority: integer('priority').notNull().default(100),
    enabled: boolean('enabled').notNull().default(true),
    /** Optional token cap for this specific key; NULL = unlimited. */
    quota: integer('quota'),
    used: integer('used').notNull().default(0),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    testStatus: text('test_status'),
    testLatencyMs: integer('test_latency_ms'),
    lastError: text('last_error'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    providerEnabledIdx: index('server_api_keys_provider_enabled_idx').on(t.provider, t.enabled),
    priorityIdx: index('server_api_keys_priority_idx').on(t.priority),
  }),
);

export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export const providerConfig = pgTable('provider_config', {
  provider: text('provider').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  defaultModel: text('default_model'),
  /** Per-provider requests-per-hour cap; NULL = use the system default. */
  rateLimit: integer('rate_limit'),
  /** Position in the fallback chain (lower runs earlier, and races second). */
  chainOrder: integer('chain_order').notNull().default(100),
  customBase: text('custom_base'),
  /** Per-agent default model override: { planner: 'glm-5.3', coder: '...' } */
  agentModels: jsonb('agent_models'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customProviders = pgTable('custom_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  iv: text('iv').notNull(),
  tag: text('tag').notNull(),
  defaultModel: text('default_model').notNull(),
  models: jsonb('models'),
  enabled: boolean('enabled').notNull().default(true),
  chainOrder: integer('chain_order').notNull().default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bannedPatterns = pgTable('banned_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  pattern: text('pattern').notNull(),
  reason: text('reason'),
  /** Case-insensitive substring match instead of a regular expression. */
  isLiteral: boolean('is_literal').notNull().default(false),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
});

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
    adminEmail: text('admin_email'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('admin_audit_log_created_idx').on(t.createdAt),
    adminIdx: index('admin_audit_log_admin_idx').on(t.adminId),
    actionIdx: index('admin_audit_log_action_idx').on(t.action),
  }),
);

/* -------------------------------------------------------------------------- */
/*  Statistics & health                                                       */
/* -------------------------------------------------------------------------- */

export const usageStats = pgTable(
  'usage_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull().default('unknown'),
    tokens: integer('tokens').notNull().default(0),
    cost: real('cost').notNull().default(0),
    requests: integer('requests').notNull().default(0),
    /** 'user' when the user's own key paid, 'server' when a shared key did. */
    billingSource: text('billing_source').notNull().default('user'),
    errors: integer('errors').notNull().default(0),
  },
  (t) => ({
    userDateIdx: index('usage_stats_user_date_idx').on(t.userId, t.date),
    providerDateIdx: index('usage_stats_provider_date_idx').on(t.provider, t.date),
    uniqueBucket: uniqueIndex('usage_stats_bucket_unique').on(
      t.userId,
      t.date,
      t.provider,
      t.model,
      t.billingSource,
    ),
  }),
);

/**
 * Rolling provider health used by the router to skip dead endpoints and by the
 * admin panel to render live status. Latency percentiles are computed from a
 * bounded sample buffer rather than pushed to an external APM.
 */
export const providerHealth = pgTable('provider_health', {
  provider: text('provider').primaryKey(),
  status: healthEnum('status').notNull().default('unknown'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  requestCount: integer('request_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  /** [p50, p95, p99] in milliseconds, recomputed on each sample. */
  latency: jsonb('latency'),
  lastLatencyMs: integer('last_latency_ms'),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Key/value store for admin system settings (app name, defaults, ...). */
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats),
  apiKeys: many(userApiKeys),
  images: many(generatedImages),
  vision: many(visionLibrary),
  usage: many(usageStats),
  accounts: many(accounts),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, { fields: [chats.userId], references: [users.id] }),
  messages: many(messages),
  projects: many(projects),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  chat: one(chats, { fields: [projects.chatId], references: [chats.id] }),
}));

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, { fields: [userApiKeys.userId], references: [users.id] }),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  user: one(users, { fields: [generatedImages.userId], references: [users.id] }),
}));

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectFile = { path: string; language: string; content: string; bytes: number };
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type ServerApiKey = typeof serverApiKeys.$inferSelect;
export type FeatureFlagRow = typeof featureFlags.$inferSelect;
export type ProviderConfigRow = typeof providerConfig.$inferSelect;
export type CustomProviderRow = typeof customProviders.$inferSelect;
export type BannedPattern = typeof bannedPatterns.$inferSelect;
export type AuditLogRow = typeof adminAuditLog.$inferSelect;
export type UsageStat = typeof usageStats.$inferSelect;
export type ProviderHealthRow = typeof providerHealth.$inferSelect;
export type SystemSettingRow = typeof systemSettings.$inferSelect;
export type GeneratedImage = typeof generatedImages.$inferSelect;
export type VisionItem = typeof visionLibrary.$inferSelect;
