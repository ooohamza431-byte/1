/**
 * Minimal `next/headers` stand-in for unit tests.
 *
 * `lib/audit/log.ts` reads the request headers server-side to record the user
 * agent and IP of an admin action. Outside a request scope Next.js throws, so
 * the stub returns an empty store instead — tests that assert on audit data
 * always pass explicit values.
 */

const EMPTY = new Headers();

export function headers(): Headers {
  return new Headers(EMPTY);
}

export function cookies(): { get(name: string): undefined; getAll(): []; has(): false } {
  return {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
  };
}
