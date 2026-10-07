import { beforeAll, vi } from 'vitest';

/**
 * Global test setup.
 *
 * A deterministic ENCRYPTION_KEY is required before any crypto assertion runs,
 * and the database URL is faked so importing a module that reads it cannot fail
 * during collection. Nothing here opens a connection: `lib/db/client.ts` builds
 * its pool lazily behind a Proxy.
 */
beforeAll(() => {
  process.env.ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.AUTH_SECRET ??= 'test-secret-value-for-unit-tests';
  process.env.POSTGRES_URL ??= 'postgres://test:test@localhost:5432/test';
});

// `server-only` guards would otherwise throw when a route-adjacent module is
// imported directly in a test.
vi.mock('server-only', () => ({}));
