/**
 * Minimal `next/server` stand-in for unit tests.
 *
 * Vitest resolves modules outside of Next's bundler, where `next/server` pulls
 * in the whole framework runtime (and, under pnpm's strict layout, sometimes
 * cannot be resolved at all from inside a dependency). Pure-logic tests only
 * need the handful of statics the middleware and route helpers touch.
 *
 * This file is NOT part of the application build — `vitest.config.ts` aliases
 * `next/server` here so a test can import `lib/auth/rbac.ts` without booting
 * Next.js.
 */

function jsonHeaders(init?: ResponseInit): Headers {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return headers;
}

export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    return new NextResponse(JSON.stringify(body), { ...init, headers: jsonHeaders(init) });
  }

  static redirect(url: string | URL, status = 307): NextResponse {
    return new NextResponse(null, { status, headers: { location: String(url) } });
  }

  static rewrite(url: string | URL): NextResponse {
    return new NextResponse(null, { status: 200, headers: { 'x-middleware-rewrite': String(url) } });
  }

  static next(init?: ResponseInit): NextResponse {
    return new NextResponse(null, { ...init, headers: { 'x-middleware-next': '1' } });
  }
}

/** The parts of a NextRequest our middleware helpers read. */
export interface NextRequestStub extends Request {
  nextUrl: URL;
  cookies: { get(name: string): { value: string } | undefined };
}

export type { NextRequestStub as NextRequest };
