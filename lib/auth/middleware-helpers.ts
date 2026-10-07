import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminRole, type Role } from '@/lib/constants';

/**
 * Route classification and response helpers shared by `middleware.ts`.
 *
 * Kept free of Node-only imports so the Edge middleware bundle stays small and
 * buildable.
 */

/** Routes mounted inside the studio — any signed-in, unbanned user. */
export const PROTECTED_PREFIXES = [
  '/studio',
  '/dashboard',
  '/images',
  '/keys',
  '/settings',
] as const;

/** Routes that need admin or owner. */
export const ADMIN_PREFIXES = ['/admin', '/api/admin'] as const;

/** Always reachable. */
export const PUBLIC_PATHS = [
  '/',
  '/about',
  '/features',
  '/pricing',
  '/docs',
  '/signin',
  '/signup',
  '/icon.svg',
  '/api/auth',
  '/api/health',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Next.js internals and static assets.
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) return true;
  if (/\.(png|jpg|jpeg|svg|ico|webp|txt|xml|css|js|map|woff2?)$/i.test(pathname)) return true;
  return false;
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/** 401/403 JSON for API routes — an API client must never receive an HTML page. */
export function forbiddenJson(message = 'Forbidden', status: 401 | 403 = 403) {
  return new NextResponse(JSON.stringify({ error: message, code: status === 401 ? 'unauthenticated' : 'forbidden' }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Redirect to the sign-in page, preserving where the user wanted to go. */
export function redirectToSignIn(request: NextRequest, reason?: string) {
  const url = new URL('/signin', request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target && target !== '/') url.searchParams.set('callbackUrl', target);
  if (reason) url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}

/**
 * The core policy decision, extracted so it can be unit-tested without a
 * request object.
 */
export type GuardDecision =
  | { action: 'allow' }
  | { action: 'redirect-signin'; reason: string }
  | { action: 'forbidden'; reason: string; status: 401 | 403 };

export function evaluateAccess(
  pathname: string,
  session: { role?: Role; banned?: boolean } | null,
): GuardDecision {
  if (isPublicPath(pathname)) return { action: 'allow' };

  /**
   * Only the studio and the admin panel are actually gated. Anything else —
   * a typo, a stale link, a future public page — is handed to Next.js so it
   * can render the 404 instead of bouncing an anonymous visitor to sign-in.
   */
  const gated = isProtectedPath(pathname) || isAdminPath(pathname);

  if (!session) {
    if (isApiPath(pathname)) return { action: 'forbidden', reason: 'Sign in required.', status: 401 };
    return gated ? { action: 'redirect-signin', reason: 'unauthenticated' } : { action: 'allow' };
  }

  if (session.banned) {
    return { action: 'forbidden', reason: 'This account is suspended.', status: 403 };
  }

  if (isAdminPath(pathname) && !isAdminRole(session.role)) {
    return { action: 'forbidden', reason: 'Administrator access required.', status: 403 };
  }

  return { action: 'allow' };
}
