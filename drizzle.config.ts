import fs from 'node:fs';
import path from 'node:path';
import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit does not read `.env.local` on its own (that is a Next.js
 * convention), so we load it manually — with `.env` as a fallback — before
 * resolving the connection string. This keeps `npm run db:push` working with
 * the exact same files Next.js uses, with zero extra dependencies.
 */
function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  const raw = fs.readFileSync(full, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

/**
 * Prefer the direct (non-pooled) connection for schema pushes: DDL statements
 * and prepared statements do not survive PgBouncer-style poolers.
 */
const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  '';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: url.replace(/[?&]sslmode=[^&]*/g, ''),
  },
  strict: false,
  verbose: true,
} satisfies Config;
