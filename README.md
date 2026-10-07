# M1 Mods MultiAgent

**A multi-provider AI studio with a six-agent build pipeline, a live preview, and a complete administration layer.**

Nine providers behind one endpoint. A planner/coder/reviewer/fixer/enhancer/judge pipeline that turns a sentence
into a runnable project with a file tree, a sandboxed preview, and ZIP or PDF export. Keyless image generation.
Vision and in-browser OCR. Roles, permissions, quotas, audit logging and moderation — the parts that turn a demo
into something you can actually let people use.

Every provider call happens server-side: **no key ever reaches the browser, and there is no CORS surface to configure.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-org%2Fm1-mods-multiagent&env=POSTGRES_URL,AUTH_SECRET,ENCRYPTION_KEY,NEXTAUTH_URL&envDescription=A%20Postgres%20URL%2C%20a%20random%20AUTH_SECRET%2C%20a%2032-byte%20hex%20ENCRYPTION_KEY%20and%20your%20public%20URL&envLink=https%3A%2F%2Fgithub.com%2Fyour-org%2Fm1-mods-multiagent%23environment-variables&project-name=m1-mods-multiagent&repository-name=m1-mods-multiagent)

MIT licensed · Next.js 15 · React 19 · TypeScript strict · Postgres + Drizzle · NextAuth v5 · Tailwind + shadcn/ui

---

## Table of contents

- [What is in the box](#what-is-in-the-box)
- [Quick start](#quick-start)
- [🚀 Deploy](#-deploy)
- [Environment variables](#environment-variables)
- [Providers](#providers)
- [The six-agent pipeline](#the-six-agent-pipeline)
- [Key resolution](#key-resolution)
- [Admin panel](#admin-panel)
- [Routes](#routes)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Owner bootstrap](#owner-bootstrap)
- [Troubleshooting](#troubleshooting)
- [Design notes](#design-notes)

---

## What is in the box

| Area | What you get |
| --- | --- |
| **Routing** | Nine built-in providers plus unlimited custom OpenAI-compatible endpoints. Health-aware ordering, a 6.5s hedge to a second provider, exponential cooldowns, and stream-stall failover at 30s. |
| **Build pipeline** | Planner → Coder → Reviewer → Fixer → Enhancer → Judge/Hardener. Any agent can be pinned to a different model. A file parser understands every fence dialect models emit. |
| **Chat** | Token-by-token streaming, collapsible thinking panels, web-search citations, usage and cost meters, auto-titling, full history. |
| **Studio** | Sandboxed live preview with a runtime error overlay, project tree, ZIP export, typeset PDF export, copy-to-clipboard. |
| **Images** | Keyless Pollinations generation with 8 style presets, 6 aspect presets, seeds, variations, one-click download, and a persisted gallery that survives a reload. |
| **Vision & OCR** | Send an image to a vision-capable provider, or OCR it entirely in the browser with tesseract.js. |
| **Admin** | Keys, users, providers, feature flags, analytics, moderation, audit log, system settings and backup — all permission-gated and audit-logged. |
| **Security** | AES-256-GCM key storage, bcrypt passwords, three roles, 14 permissions, rate limiting (Upstash or in-process), strict CSP, and server-only provider calls. |

## Quick start

**Prerequisites:** Node 18.18+ and a PostgreSQL database (Neon, Supabase, Railway, RDS, or a local Postgres all work).

```bash
git clone https://github.com/your-org/m1-mods-multiagent.git
cd m1-mods-multiagent
pnpm install
cp .env.example .env.local
```

Generate the two required secrets:

```bash
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -hex 32      # -> ENCRYPTION_KEY   (exactly 64 hex characters)
```

Fill in `POSTGRES_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY` and `NEXTAUTH_URL` (or `AUTH_URL`), then:

```bash
pnpm db:push     # create the 19 tables
pnpm db:seed     # feature flags, provider chain, starter moderation rules
pnpm dev         # http://localhost:3000
```

The app boots with **zero provider keys configured**. The image studio works immediately (Pollinations is keyless),
and `/api/health` names exactly what is still missing:

```bash
curl -s localhost:3000/api/health | jq
```

### Adding your first provider key

Two paths, both live immediately:

- **Per user** — sign in, open `/studio/keys`, paste a key. Yours is tried first for your requests.
- **Server-wide** — an admin opens `/admin/keys` and stores a key, or you set `DEFAULT_*_KEY` variables and run
  `pnpm db:seed`. New accounts can then build with no setup at all.

## 🖼️ Embedding & security headers

`frame-ancestors 'none'` and `X-Frame-Options: DENY` are applied to every ordinary host — production included — from
`middleware.ts`. Hosted preview environments (`*.e2b.app`, plus anything in the optional `PREVIEW_EMBED_HOSTS`
comma-separated env var) are the one exception: they get `frame-ancestors 'self' https://*.e2b.app` and no
`X-Frame-Options`, so a preview pane can render the app instead of an empty rectangle. The CSP lives in the same
place — do not add a second one to `next.config.js`, or the per-request decision gets overridden.

## 🚀 Deploy

### Option A — the button

Hit the Deploy button at the top of this file. Provide the four required variables when prompted, then add a
Postgres integration (Neon, via the Vercel Marketplace) so `POSTGRES_URL` is injected automatically.

### Option B — the CLI, exactly as it runs

```bash
# 1. install the CLI and sign in
pnpm dlx vercel@latest login

# 2. link this folder to a project (creates .vercel/)
pnpm dlx vercel@latest link

# 3. set the required variables for production
pnpm dlx vercel@latest env add POSTGRES_URL production
pnpm dlx vercel@latest env add AUTH_SECRET production
pnpm dlx vercel@latest env add ENCRYPTION_KEY production
pnpm dlx vercel@latest env add NEXTAUTH_URL production      # https://<project>.vercel.app

# 4. optional but recommended
pnpm dlx vercel@latest env add OWNER_EMAIL production        # your address -> auto-promoted to owner
pnpm dlx vercel@latest env add UPSTASH_REDIS_REST_URL production
pnpm dlx vercel@latest env add UPSTASH_REDIS_REST_TOKEN production

# 5. ship it
pnpm dlx vercel@latest --prod
```

What happens during that deploy: `pnpm install` runs, then the `postinstall` hook
(`drizzle-kit push --force || true`) creates or syncs the schema, then `next build` compiles every route. The
`|| true` is deliberate — a build must not fail because the database is briefly unreachable.

After the first deploy:

```bash
# 6. add the database (Neon) from the Vercel dashboard → Storage → Marketplace,
#    which injects POSTGRES_URL, or set it yourself:
pnpm dlx vercel@latest env add POSTGRES_URL production

# 7. re-deploy so the schema is pushed against the real database
pnpm dlx vercel@latest --prod

# 8. seed the defaults against production
POSTGRES_URL="postgres://…" pnpm db:seed

# 9. set OWNER_EMAIL, then sign in once — that account becomes the owner
```

### Other hosts

Anything that can run `next build` + `next start` works: Fly.io, Railway, Render, a VPS, Docker. The only
requirements are a Node 18.18+ runtime, a Postgres connection string, and the four required environment variables.
`vercel.json` is harmless outside Vercel.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `POSTGRES_URL` | ✅ | Pooled Postgres connection string. Falls back to `DATABASE_URL`, then `POSTGRES_URL_NON_POOLING`, then `DATABASE_URL_UNPOOLED`. |
| `AUTH_SECRET` | ✅ | NextAuth v5 signing secret — `openssl rand -base64 32`. |
| `ENCRYPTION_KEY` | ✅ | Exactly 64 hex characters (32 bytes) for AES-256-GCM. **Losing this makes stored provider keys unrecoverable.** |
| `NEXTAUTH_URL` / `AUTH_URL` | ✅ | The public origin, e.g. `https://your-app.vercel.app`. Must match exactly, or sign-in loops. Behind a reverse proxy, also set `AUTH_TRUST_HOST=true`. |
| `AUTH_TRUST_HOST` | — | Required by some self-hosted proxies; set to `true` when NextAuth cannot infer the host. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | Enables Google sign-in. Redirect URI: `https://your-domain/api/auth/callback/google`. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | — | Enables GitHub sign-in. Redirect URI: `https://your-domain/api/auth/callback/github`. |
| `OWNER_EMAIL` | — | Promoted to `owner` on first sign-in. The one bootstrap that cannot be done from the UI. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | Distributed rate limiting. Without it the app uses an in-process limiter (per instance). |
| `DEFAULT_ZAI_KEY`, `DEFAULT_GOOGLE_KEY`, `DEFAULT_OPENROUTER_KEY`, `DEFAULT_GROQ_KEY`, `DEFAULT_CEREBRAS_KEY`, `DEFAULT_MISTRAL_KEY`, `DEFAULT_DEEPSEEK_KEY`, `DEFAULT_OPENAI_KEY` | — | Imported into the admin panel as server keys by `pnpm db:seed`. |
| `POLLINATIONS_TOKEN` | — | Optional. Image generation works keyless; a token (or `referrer`) raises limits and removes the watermark. |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL` | — | Cosmetic overrides used by the UI. |

> **Never commit `.env.local`.** It is already in `.gitignore`.

## Providers

| Provider | Base | Thinking / reasoning | Vision | Key |
| --- | --- | --- | --- | --- |
| **Z.ai (GLM)** | `api.z.ai/api/paas/v4` | `thinking.type` enabled/disabled, `reasoning_content` | GLM-4V / 5V | required |
| **Google Gemini** | `generativelanguage.googleapis.com/v1beta/openai` | `reasoning_effort` + `thinking_config` | ✅ | required |
| **OpenRouter** | `openrouter.ai/api/v1` | model-dependent | ✅ | required |
| **Groq** | `api.groq.com/openai/v1` | reasoning models | — | required |
| **Cerebras** | `api.cerebras.ai/v1` | gpt-oss reasoning | — | required |
| **Mistral** | `api.mistral.ai/v1` | magistral family | Pixtral / OCR | required |
| **DeepSeek** | `api.deepseek.com/v1` | `thinking.enabled`, `reasoning_effort` | Flash models | required |
| **OpenAI** | `api.openai.com/v1` | `reasoning_effort` | ✅ | required |
| **Pollinations** | `image.pollinations.ai` + `text.pollinations.ai/openai` | n/a | image generation | **keyless** |
| **Custom** | your `baseUrl` | as the upstream supports | — | optional |

Model IDs change constantly, so the catalogue is not hardcoded: `/api/models/discover` asks each provider what it
currently serves, and `lib/providers/*.ts` ships sensible defaults for cold starts. The provider-specific request
shapes (thinking toggles, reasoning fields, vision parts, error taxonomies) were verified against live
documentation — see `VERIFICATION.md` for the exact endpoints and parameters.

## The six-agent pipeline

A build is not one model call. The prompt is classified first, then specialised agents run in sequence — each one
routable to a different provider and model via `/admin/providers`:

| # | Agent | Job |
| --- | --- | --- |
| 1 | **Planner** | Turns the request into a file-by-file plan and picks the tech. No code yet. |
| 2 | **Coder** | Writes the files as annotated fenced blocks. |
| 3 | **Reviewer** | Reads the code back and answers `APPROVED` or `BUGS FOUND:` with a numbered list. |
| 4 | **Fixer** | Repairs exactly the reported defects and re-emits only the files it touched. (Skipped for trivial builds.) |
| 5 | **Enhancer** | Adds polish — accessibility, empty states, responsive behaviour — without changing intent. |
| 6 | **Judge / Hardener** | Scores the build out of 10, lists defects, and loops the hardener until the target score is met or the round cap is hit. Runs only when **Deep Harden** is enabled. |

Defaults live in `PIPELINE_DEFAULTS` (`lib/constants.ts`):

```ts
maxRounds: 2            // harden loops before the best build is kept
targetScore: 9          // judge score that stops the loop
hedgeDelayMs: 6500      // hedge to a second provider after this long
requestTimeoutMs: 240000
maxOutputTokens: 32000
```

The file parser accepts every dialect models actually emit — ```` ```html file="index.html" ````,
```` ```tsx App.tsx ````, a `// file: src/x.ts` first line, or a bare language fence with a name inferred from the
language. Paths are normalised with a segment stack, so `../` can never escape the ZIP root.

## Key resolution

For every request, in this order:

1. **The user's own key** for that provider (`/studio/keys`, encrypted at rest).
2. **The admin's server key** for that provider (`/admin/keys`, or seeded from `DEFAULT_*_KEY`).
3. **A keyless provider** where the capability allows it (Pollinations images).
4. **A clear error** naming the provider and where to add a key — never a silent failure.

The source used is reported back in the SSE `meta` frame and shown in the UI, so nobody has to guess who paid for
a request. Keys are stored AES-256-GCM encrypted (`v1.<iv>.<tag>.<ciphertext>`), decrypted only inside the request
that needs them, and displayed in the UI only as a masked hint (`sk-…mnop`).

## Admin panel

Everything under `/admin` is gated twice: the layout checks `session.user.role` on the server, and every
`/api/admin/*` route re-checks the specific permission. Nothing is hidden-but-reachable.

| Page | Permission | What it does |
| --- | --- | --- |
| `/admin` | `analytics.read` | Attention queue (down providers, missing or failing keys, flagged messages, error spikes), KPIs, provider health, newest accounts. |
| `/admin/keys` | `keys.read` | Server keys with masked display, live test, cooldowns, bulk import, enable/disable. |
| `/admin/users` | `users.read` | Search and filter, per-user usage and cost, role changes, bans, cascading delete, quota overrides. |
| `/admin/providers` | `providers.write` | Chain ordering, enable/disable, model allowlists, cooldown clearing, custom endpoints. |
| `/admin/features` | `features.write` | 17 feature flags across generation / access / system, plus maintenance mode. |
| `/admin/analytics` | `analytics.read` | Requests, tokens, latency percentiles (p50/p90/p99), error rate, top models, daily series, cost per user, billing split. |
| `/admin/moderation` | `moderation.read` | Flagged messages, banned-pattern rules (regex or literal, validated before saving), CSV export. |
| `/admin/audit` | `audit.read` | Every privileged action: actor, target, IP, user agent, JSON diff. |
| `/admin/system` | `system.write` | Diagnostics (database, encryption, Upstash, OAuth, owner), editable settings, full JSON backup. |

Roles are ranked `user` (0) < `admin` (1) < `owner` (2). Two permissions are owner-only by design —
`system.write` and `users.delete` — so an admin cannot quietly lock you out or wipe the database.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing home: hero, provider strip, features, pipeline, FAQ. |
| `/pricing`, `/docs`, `/about` | Plans, full operator documentation, and the project story. |
| `/signin`, `/signup` | Credentials plus Google/GitHub OAuth. |
| `/studio` | Chat mode with streaming, thinking, web search and usage meters. |
| `/studio/build` | Build mode: pipeline bar, per-agent steps, project tree, live preview, export. |
| `/studio/images` | Image Studio (Keyless Pollinations). |
| `/studio/history` | Conversations and projects, searchable. |
| `/studio/keys` | Your own provider keys, masked, with live tests. |
| `/studio/settings` | Theme (dark default, light, system), default models, preferences. |
| `/studio/[chatId]` | Reopens a saved conversation, rebuilding the preview from stored files. |
| `/dashboard` | Your usage: requests, tokens, estimated cost, favourite models. |
| `/admin/*` | The nine pages above. |
| `/api/health` | Public readiness probe: database, encryption, auth. 503 until everything is configured. |

## Project structure

```
m1-mods-multiagent/
├── app/
│   ├── (marketing)/           # public pages: home, pricing, docs, about
│   ├── (auth)/                # signin, signup
│   ├── (studio)/              # the signed-in app: studio, dashboard
│   ├── (admin)/admin/         # the nine admin pages
│   └── api/                   # every route handler, all runtime = nodejs
├── components/
│   ├── ui/                    # 22 shadcn-style primitives
│   ├── studio/                # composer, pipeline bar, preview pane, image studio…
│   ├── admin/                 # tables, charts, moderation and system panels
│   ├── marketing/             # footer, provider marquee
│   └── auth/
├── hooks/                     # 11 data hooks (chat, providers, keys, admin…)
├── lib/
│   ├── agents/                # parser, prompts, pipeline (the six agents)
│   ├── api/                   # rate limiting, moderation, SSE, route helpers
│   ├── auth/                  # auth.config (edge) + auth (node) + rbac
│   ├── crypto/                # AES-256-GCM helpers
│   ├── db/                    # schema (19 tables), queries, admin queries
│   ├── providers/             # one file per provider + the registry
│   ├── router/                # classify, chain, hedge, health, resolve-key
│   └── utils/                 # format, intent, image prompts, OCR, exporters
├── stores/                    # zustand: chat, ui, image
├── scripts/seed.ts            # idempotent database seed
├── tests/                     # vitest units + playwright e2e
├── drizzle/migrations/        # empty by default: the schema is pushed (see its README)
└── middleware.ts              # edge auth + RBAC guard
```

## Testing

```bash
pnpm typecheck     # tsc --noEmit, strict, zero errors
pnpm test          # vitest: parser, classifier, crypto, RBAC, router, formatting
pnpm test:watch    # the same, in watch mode
pnpm test:e2e      # playwright: marketing, auth gating, health, API protection
pnpm lint          # next lint
```

The unit suite mocks the database away, so it runs in a couple of seconds with no Postgres and no network.
The Playwright suite splits into public specs (they run against any instance, database or not) and authenticated
specs, which are skipped unless you provide credentials:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=… pnpm test:e2e         # enables the studio specs
E2E_EMAIL=… E2E_PASSWORD=… E2E_LIVE=1 pnpm test:e2e           # also spends real tokens on a chat turn
E2E_BASE_URL=https://your-app.vercel.app pnpm test:e2e        # point at a deployed instance
```

Playwright ships without browsers; run `pnpm dlx playwright install chromium` the first time.

## Owner bootstrap

1. Set `OWNER_EMAIL=you@example.com` and sign in once — the account is promoted to `owner` on that first sign-in.
2. Or, after signing up, run `pnpm db:seed` with `OWNER_EMAIL` set; it promotes a matching existing account, or
   prints the exact SQL to run by hand.
3. From then on it is all in the UI: `/admin/users` changes roles.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `/api/health` returns 503 | One of database / encryption / auth is missing. The JSON body names which check failed. |
| `ENCRYPTION_KEY must be 64 hex characters` | Generate one with `openssl rand -hex 32`. |
| Stored keys suddenly unreadable | `ENCRYPTION_KEY` changed. Re-enter the affected keys, or restore the original secret. |
| "No provider available" | No key resolves for that capability. Add one at `/studio/keys`, or a server key at `/admin/keys`. |
| Sign-in redirect loop | `NEXTAUTH_URL` does not match the real origin. Include the scheme, no trailing slash. |
| `OAuthCallback` / `redirect_uri_mismatch` | Register `https://your-domain/api/auth/callback/google` (and `/github`) with the provider. |
| A provider keeps getting skipped | It is cooling down after an error. `/admin/providers` shows the reason and can clear it after a re-test. |
| Images don't appear (HTTP 402 from Pollinations) | The keyless image tier is IP-throttled and refuses shared/datacenter egress. Set `POLLINATIONS_TOKEN` (free) and the same URLs render. The studio says so on the tile instead of failing silently. |
| Sign-in works, then bounces back to `/signin` | `NEXTAUTH_URL`/`AUTH_URL` does not match the origin you are browsing. Pin it to the exact public origin, and set `AUTH_TRUST_HOST=true` behind a proxy. |
| Generated apps render blank in the preview pane | Two causes, both handled: the iframe is sandboxed without `allow-same-origin` so `localStorage` throws (the coder prompt requires a try/catch fallback), and the pane is viewport-height by design — if you restyle the shell, keep `h-screen` on the wrapper and `h-full min-h-0` on the panes or the iframe will grow with its content. |
| Chat counters or the admin usage column show 0 | Fixed in `listChatsWithCounts` / `listUsersWithStats`: raw `sql` templates render column names unqualified, so correlated subqueries silently match nothing. Use grouped aggregates (the pattern both functions now follow). |
| `429` at 100 requests/hour | The default limiter. Add Upstash credentials for a distributed one, or adjust `lib/api/rate-limit.ts`. |
| Build output is truncated | The upstream dropped the stream. The router hedges after 6.5s; files already streamed are kept. |
| `pnpm install` fails on `postinstall` | Expected when no database is configured — the hook is `|| true` by design. |
| Migration drift after editing `schema.ts` | `pnpm db:push` for development; switch to `db:generate` + `db:migrate` once you have production data. |

## Design notes

- **Server-only provider calls.** Every provider request is a Node-runtime route handler. That is why there is no
  CORS configuration anywhere in this repository, and why the CSP can stay strict.
- **Edge-safe auth split.** `lib/auth/auth.config.ts` holds the NextAuth config the middleware needs and imports
  nothing from the database, bcrypt or postgres. Session callbacks get the DB in `lib/auth/auth.ts`, which only
  Node routes load. (This is also why role predicates live in `lib/constants.ts`.)
- **Lazy database.** The Postgres pool is created on first query behind a Proxy, so a machine with no `POSTGRES_URL`
  can still build, typecheck and render the marketing pages.
- **One theme source.** All design tokens live in `app/globals.css` (including the handwritten highlight.js theme —
  no CDN stylesheet, so the app works fully offline). Dark is the default: `#191919` background, `#262626` panels,
  `#3a3a3a` borders, `#d97757` brand.
- **Fire-and-forget health.** Provider health is kept in-process for routing decisions and persisted to Postgres
  for the admin dashboard. A dead database must never stop chat from working.

---

MIT © M1 Mods. Provider names and marks belong to their owners; this project is not affiliated with any of them.
