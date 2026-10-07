import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Lazy Postgres client.
 *
 * The connection is created on first use rather than at import time so that:
 *   - `next build` never needs a live database (no top-level connection),
 *   - serverless cold starts that only serve static assets stay cheap,
 *   - a missing DATABASE_URL produces a clear runtime error instead of a
 *     build-time crash.
 *
 * `prepare: false` is required for PgBouncer-style poolers (Neon's pooled
 * endpoint, Supabase's transaction pooler, Vercel's own proxy).
 */

type Db = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __m1_pg__: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __m1_db__: Db | undefined;
}

export function getDatabaseUrl(): string {
  const url =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    '';
  if (!url) {
    throw new Error(
      'No Postgres connection string found. Set POSTGRES_URL (Neon integration / docker) or DATABASE_URL in your environment.',
    );
  }
  return url.replace(/[?&]sslmode=[^&]*/g, '');
}

export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL_UNPOOLED,
  );
}

function createClient() {
  const url = getDatabaseUrl();
  const isLocal = /localhost|127\.0\.0\.1/.test(url);

  return postgres(url, {
    prepare: false,
    max: isLocal ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocal ? false : 'require',
    onnotice: () => {},
  });
}

/** Raw postgres.js client (used by the seed script and admin maintenance jobs). */
export function getSqlClient() {
  if (!globalThis.__m1_pg__) {
    globalThis.__m1_pg__ = createClient();
  }
  return globalThis.__m1_pg__;
}

/**
 * Drizzle instance. Cached on `globalThis` so Next.js hot-reload in dev does not
 * leak a connection pool per recompile.
 */
export function getDb(): Db {
  if (!globalThis.__m1_db__) {
    globalThis.__m1_db__ = drizzle(getSqlClient(), { schema, logger: false });
  }
  return globalThis.__m1_db__;
}

/** Convenience proxy so call sites can `import { db } from '@/lib/db/client'`
 *  and still get lazy behaviour — the connect happens on first property access. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export { schema };
export type Database = Db;
