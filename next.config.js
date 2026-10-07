/** @type {import('next').NextConfig} */
/**
 * Static security headers.
 *
 * The Content Security Policy and `X-Frame-Options` are deliberately NOT here:
 * framing is decided per request in `middleware.ts`, because hosted preview
 * environments (`*.e2b.app`, plus `PREVIEW_EMBED_HOSTS`) need to frame the app
 * while every other host — production included — must not. Emitting a second
 * CSP from this file would override the middleware's per-request decision.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `postgres`, `bcryptjs` and `tesseract.js` must stay external to the server
  // bundle — they are Node-only or ship wasm/worker assets.
  serverExternalPackages: ['postgres', 'bcryptjs', 'tesseract.js'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.pollinations.ai' },
      { protocol: 'https', hostname: '*.pollinations.ai' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  eslint: {
    // Linting is run explicitly via `npm run lint`; do not fail production
    // builds on style warnings.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;
