import NextAuth from 'next-auth';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';
import {
  evaluateAccess,
  forbiddenJson,
  isApiPath,
  redirectToSignIn,
} from '@/lib/auth/middleware-helpers';

/**
 * Edge middleware: authentication + RBAC + admin route guard + security headers.
 *
 * This file deliberately imports only `auth.config` (edge-safe). The database,
 * bcrypt and the postgres driver enter the picture exclusively in Node-runtime
 * route handlers, never here.
 *
 * Policy (see `evaluateAccess`):
 *   • public marketing/auth pages  → always allowed
 *   • studio pages                 → signed-in, non-banned users
 *   • /admin/* and /api/admin/*    → role `admin` or `owner`
 *   • APIs answer with 401/403 JSON; pages redirect to /signin
 */

const { auth } = NextAuth(authConfig);

/** The Auth.js wrapper, normalised to a middleware-shaped signature. */
const runAuth = auth((request) => {
  const { nextUrl } = request;
  const authUser = request.auth?.user;
  const session = authUser ? { role: authUser.role, banned: authUser.banned } : null;

  const decision = evaluateAccess(nextUrl.pathname, session);

  switch (decision.action) {
    case 'allow':
      return NextResponse.next();

    case 'redirect-signin':
      return redirectToSignIn(request, decision.reason);

    case 'forbidden':
      if (isApiPath(nextUrl.pathname)) {
        return forbiddenJson(decision.reason, decision.status);
      }
      // Non-API page hit without permission: send them somewhere useful rather
      // than showing a bare 403 page. A suspended account must go to the public
      // sign-in page — sending it to /studio would loop, because /studio is
      // itself gated.
      if (decision.status === 401 || authUser?.banned) {
        return redirectToSignIn(request, authUser?.banned ? 'suspended' : decision.reason);
      }
      return NextResponse.redirect(new URL('/studio?error=forbidden', request.url));

    default:
      return NextResponse.next();
  }
});

/* -------------------------------------------------------------------------- */
/*  Security headers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Hosts that are allowed to frame the app.
 *
 * The application itself is not frameable: `frame-ancestors 'none'` plus
 * `X-Frame-Options: DENY` for every ordinary host, including production.
 * Hosted preview environments are the documented exception — the sandbox live
 * preview proxy (`*.e2b.app`) and anything an operator lists in
 * `PREVIEW_EMBED_HOSTS` must be able to render the app inside a pane, and a
 * blanket `DENY` would present the operator with an empty rectangle.
 *
 * Framing is therefore decided per request here rather than statically in
 * `next.config.js`, and `next.config.js` no longer emits a CSP or an
 * `X-Frame-Options` header at all: two places writing the same header is how
 * you end up relaxing production by accident.
 */
const EMBED_HOST_SUFFIXES = ['.e2b.app'];

function isEmbeddableHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(':')[0]!.toLowerCase();
  const extra = (process.env.PREVIEW_EMBED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return [...EMBED_HOST_SUFFIXES, ...extra].some(
    (suffix) => hostname === suffix.replace(/^\./, '') || hostname.endsWith(suffix),
  );
}

/**
 * Content Security Policy.
 *
 * - Provider API calls are NEVER made from the browser (everything is proxied
 *   through our own `/api/*` route handlers), so `connect-src` only needs to
 *   allow our own origin plus Pollinations image fetches which the browser
 *   performs directly (that is the whole point of the free image endpoint).
 * - `unsafe-eval` is required by the Next.js dev overlay/HMR only.
 * - `blob:` + `data:` are required for ZIP/PDF downloads and OCR worker blobs.
 * - tesseract.js loads its worker + wasm + language data from a CDN, and
 *   Pollinations serves images from *.pollinations.ai.
 */
function contentSecurityPolicy(frameAncestors: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://cdn.jsdelivr.net https://unpkg.com blob:`,
    "worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.pollinations.ai https://*.pollinations.ai",
    "font-src 'self' data:",
    "media-src 'self' blob: https://*.pollinations.ai",
    "connect-src 'self' https://*.pollinations.ai https://text.pollinations.ai https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com",
    "frame-src 'self' blob: data:",
    frameAncestors,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function applySecurityHeaders(request: NextRequest, response: Response): Response {
  if (isEmbeddableHost(request.headers.get('host'))) {
    // Embeddable: no X-Frame-Options (it has no allow-list form), and a CSP that
    // still refuses framing from anywhere except the preview proxies.
    response.headers.set('Content-Security-Policy', contentSecurityPolicy("frame-ancestors 'self' https://*.e2b.app"));
  } else {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy("frame-ancestors 'none'"));
    response.headers.set('X-Frame-Options', 'DENY');
  }
  return response;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent): Promise<Response> {
  // `auth()` reports the route-handler context type; Next accepts the handler
  // directly as a default export, so only the call shape needs narrowing here.
  const handler = runAuth as unknown as (
    request: NextRequest,
    event: NextFetchEvent,
  ) => Promise<Response>;
  const response = (await handler(request, event)) ?? NextResponse.next();
  return applySecurityHeaders(request, response);
}

export const config = {
  /**
   * Run on everything except Next internals and static files. The matcher is
   * intentionally broad because `evaluateAccess` re-checks public paths — this
   * keeps a single source of truth for the policy. Security headers ride along
   * with it: every HTML and JSON response the app can produce is matched, and
   * framing a `.css` file is not a thing.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf)$).*)',
  ],
};
