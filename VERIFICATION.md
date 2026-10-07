# Live API & Dependency Verification

Every provider integration in this project was written against documentation and
live endpoints fetched on **2026-10-07**, not against model memory. This file is
the audit trail. Where the original brief disagreed with reality, the reality
won and the difference is recorded below.

## 1. Providers

| Provider | Base URL (verified) | Auth | Thinking / reasoning mechanism (verified) |
| --- | --- | --- | --- |
| Google (Gemini) | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | `Authorization: Bearer <key>` | `reasoning_effort` (OpenAI-compat) **or** `extra_body.google.thinking_config.include_thoughts` + `thinking_level` / `thinking_budget` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer <key>` + `HTTP-Referer` + `X-Title` | `reasoning.effort`, `include_reasoning`; web search via `plugins: [{ id: 'web' }]` |
| Z.ai (Zhipu GLM) | `https://api.z.ai/api/paas/v4/chat/completions` | `Authorization: Bearer <key>` | `thinking: { type: 'enabled' \| 'disabled' }` (**confirmed** — the brief's suspected field name was correct) + `reasoning_effort` on GLM-5.3; response carries `reasoning_content` and `web_search[]` |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `Authorization: Bearer <key>` | `reasoning_effort` / `include_reasoning` on gpt-oss models |
| Cerebras | `https://api.cerebras.ai/v1/chat/completions` | `Authorization: Bearer <key>` | `reasoning_effort` on gpt-oss-120b |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | `Authorization: Bearer <key>` | n/a (reasoning models expose `content` chunks normally) |
| DeepSeek | `https://api.deepseek.com(+/v1)/chat/completions` | `Authorization: Bearer <key>` | `thinking: { type: 'enabled' }` + `reasoning_effort: low\|high\|max`; CoT returned as `reasoning_content`; `temperature` is ignored in thinking mode |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | `reasoning_effort: low\|medium\|high\|xhigh\|max` |
| Pollinations | `https://image.pollinations.ai/prompt/{prompt}` (image), `https://text.pollinations.ai/openai` (OpenAI-compatible text) | none (optional `token` / `referrer`) | n/a |

### Model IDs captured live (2026-10-07)

These are seeded as defaults and then refreshed at runtime through
`/api/models/discover`, because vendor catalogs change without notice.

- **Z.ai**: `glm-5.3`, `glm-5.2`, `glm-5.1`, `glm-5`, `glm-4.7`, `glm-4.7-flash`, `glm-4.7-flashx`, `glm-4.6`, `glm-4.5`, `glm-4.5-air`, `glm-4.5-flash`
- **Google**: `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.1-pro`, `gemini-3.5-flash-lite`, `gemini-3-pro-image`, `gemini-2.5-pro`, `gemini-2.5-flash`
- **OpenAI**: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-sol`, `gpt-5.6-cyber`, `gpt-image-2.5-sunburst`
- **Cerebras** (only two models on shared inference): `gpt-oss-120b`, `qwen-3.8-27b`
- **Groq**: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-safeguard-20b`, `whisper-large-v3`
- **Mistral**: `mistral-large-latest` (Mistral Large 4), `mistral-medium-latest` (Medium 3.5), `mistral-small-latest` (Small 4), `codestral-latest`, `ministral-3-14b`, `mistral-ocr-4-1`, `voxtral-mini-transcribe-26-02`
- **DeepSeek**: `deepseek-flash`, `deepseek-v4-pro` (legacy `deepseek-chat` / `deepseek-reasoner` names are retired and re-routed by the vendor)
- **OpenRouter**: 465 models live; free tier currently includes `nvidia/nemotron-3.5-lightning:free`, `thinkingmachines/inkling:free`, `poolside/laguna-s-2.1:free`, `cohere/north-mini-code:free`, `inclusionai/ling-3.1-flash`. Frontier: `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5`, `openai/gpt-6-astra`, `openai/gpt-6.1-sol`, `google/gemini-3.8-flash`, `z-ai/glm-5.3-prime`, `qwen/qwen3.8-max-prime`
- **Pollinations images**: `GET https://image.pollinations.ai/models` currently returns `["sana"]`. `flux` / `turbo` are still *accepted* (the service silently serves `sana`), so the model picker keeps them but marks `sana` as the live default. The app never hardcodes a model blindly: it validates against the live endpoint and falls back.
- **Pollinations text** (anonymous tier): exactly one model, `openai-fast` (GPT-OSS 20B reasoning).

### Corrections to the original brief

1. **Vercel Postgres no longer exists.** Vercel retired it and auto-migrated
   every database to Neon in December 2024. The `POSTGRES_URL` etc. variable
   names survive because the Neon marketplace integration injects them — the
   spec's env block is kept verbatim for that reason, but the README documents
   the real (Marketplace → Neon/Supabase) setup path.
2. **Next.js 16 renames `middleware.ts` → `proxy.ts`.** The brief mandates
   `middleware.ts`, so the project targets **Next.js 15.5.x** ("14.2+" satisfied,
   middleware preserved, React 19 supported).
3. **NextAuth v5 is still beta** (`next-auth@5.0.0-beta.32`; Auth.js has since
   joined Better Auth). It is pinned exactly, and code uses the v5 API
   (`auth()`, `handlers`) rather than the v4 `getServerSession()` shown in the
   brief.
4. **Pollinations model list is much smaller than the brief assumed** — `flux`,
   `flux-realism`, `flux-anime`, `flux-3d`, `turbo`, `kontext` are *not* all
   live. Only `sana` is advertised. The UI discovers models at runtime.
5. **Cerebras hosts two models**, not a broad Llama/Qwen catalog.
6. **DeepSeek's `deepseek-chat` / `deepseek-reasoner` are retired** in favour of
   `deepseek-flash` / `deepseek-v4-pro`.

## 2. Dependencies (latest versions resolved from the npm registry on 2026-10-07)

| Package | Pinned | Why this version |
| --- | --- | --- |
| `next` | `15.5.27` | Latest 15.x; keeps `middleware.ts`; React 19 |
| `react` / `react-dom` | `19.3.0` | Required by Next 15 |
| `next-auth` | `5.0.0-beta.32` | Latest v5 beta (stable line is still v4) |
| `drizzle-orm` / `drizzle-kit` | `0.45.3` / `0.31.11` | Current stable |
| `postgres` | `3.4.9` | postgres.js driver; pooler-safe with `prepare: false` |
| `tailwindcss` | `3.4.19` | Brief mandates 3.4 + `tailwind.config.ts` (v4 is CSS-first) |
| `zod` | `3.25.76` | v3 API pairing cleanly with `@hookform/resolvers` |
| `lucide-react` | `1.52.0` | Current; every icon used is verified by `tsc` in the build |
| `recharts` | `3.10.1` | Admin analytics charts |
| `jspdf` / `jspdf-autotable` | `4.2.1` / `5.0.8` | PDF export |
| `tesseract.js` | `7.0.0` | Client-side OCR (loaded lazily, dynamic import) |
| `@upstash/ratelimit` / `@upstash/redis` | `2.2.0` / `1.39.0` | Distributed rate limiting |

## 3. Live endpoint checks performed

```
openrouter.ai/api/v1/models                  -> 200, 465 models, 20 free
image.pollinations.ai/models                 -> 200, ["sana"]
image.pollinations.ai/prompt/...?width=64    -> 200, image/jpeg, 1802 bytes  (default, sana, and flux all return valid JPEG)
text.pollinations.ai/models                  -> 200, [openai-fast]
docs.z.ai/api-reference/llm/chat-completion  -> thinking.type confirmed
inference-docs.cerebras.ai/models/overview   -> gpt-oss-120b, qwen-3.8-27b
api-docs.deepseek.com/quick_start/pricing    -> deepseek-flash, deepseek-v4-pro
ai.google.dev/gemini-api/docs/openai         -> reasoning_effort + extra_body.google.thinking_config
vercel.com/docs/postgres                     -> "Vercel Postgres is no longer available"
```

## 4. Build & test verification (2026-10-07)

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | **0 errors** (strict, whole project incl. `scripts/` and `tests/`) |
| Unit tests | `npx vitest run` | **95 passed / 95**, 5 files |
| Production build | `npx next build` | **success** — 47 routes compiled, middleware 88.1 kB |
| Edge safety | build-time | `middleware.ts` bundles `auth.config.ts` only; no `node:crypto`, no postgres, no bcrypt in the Edge graph |

### The one real build failure, and the fix

The first `next build` failed with:

```
UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
  node:crypto -> lib/crypto/encrypt.ts -> lib/db/queries.ts -> lib/auth/rbac.ts
    -> lib/auth/middleware-helpers.ts -> middleware.ts (Edge bundle)
```

`middleware-helpers.ts` only needed the pure predicate `isAdminRole`, but importing it from `rbac.ts` dragged the
whole database chain into the Edge runtime. The fix is structural, not a workaround: **`isAdminRole`, `isOwnerRole`
and `hasRoleAtLeast` now live in `lib/constants.ts`** (a module with no imports at all), and `rbac.ts` re-exports
them for server callers. `middleware-helpers.ts` imports from `constants` and never touches `rbac`, `auth` or the
database. The Edge bundle is now free of `node:` built-ins entirely.

### Things the build caught that a code review would not

1. **Zip Slip in `sanitizePath`** — a single leftover `..` segment survived path cleaning. Replaced with a real
   segment-stack resolution, with a unit test asserting `../../secrets.txt` → `secrets.txt` and `a/../../b/c.txt` → `b/c.txt`.
2. **Preview document for non-HTML entries** — `buildPreviewDocument` treated whatever the entry path pointed at as
   HTML, so a CSS-only export rendered its stylesheet as a page. It now requires `.html?`/`language === 'html'` and
   otherwise synthesises a self-contained document.
3. **Stale route in the middleware** — a forbidden non-API request redirected to `/chat`, a route that no longer
   exists. It now goes to `/studio?error=forbidden`.
4. **Dead code in the harden loop** — a self-assignment (`final = … ? final : final`) and a `pipelineSequence` that
   appended `hardener` on top of an `intent.agents` that already contained it.
5. **Deep Harden was ignored on simple builds** — the judge/hardener pair only ran for `moderate`+ prompts, so the
   explicit user toggle silently did nothing. It now runs for every non-trivial build.
6. **Duplicated prompt clauses** — the image enhancer's style preset and quality tail both contributed
   "ultra detailed, high dynamic range". Deduplication is now clause-level, not whole-string.

## 5. Acceptance checklist

Run against the production build (`npx next build` → `npx next start -H 0.0.0.0`) with placeholder credentials and no
reachable database — i.e. the worst case for a fresh deployment.

| Requirement | Evidence |
| --- | --- |
| Fresh clone installs and builds with no database | `pnpm install` (install hook is `drizzle-kit push --force \|\| true`), `npx tsc --noEmit` → 0 errors, `npx next build` → 47 routes |
| Deploys to Vercel from the CLI | `vercel.json` present; README §🚀 Deploy lists the exact `vercel link` / `env add` / `--prod` sequence |
| Zero CORS surface | No client component imports `lib/providers/*` (verified by grep); every upstream call happens in a `runtime = 'nodejs'` route handler |
| Streaming chat with thinking traces | `/api/chat` emits `meta · log · agent · delta · thinking · web · usage · files · error · done`; anonymous POST → `401 {"error":"Sign in required.","code":"unauthenticated"}` |
| Signup → build → preview → ZIP/PDF | `/signup`, `/studio/build`, `buildPreviewDocument`, and `lib/utils/exporters.ts` (`exportZip`, `exportPdf`) |
| Image Studio with no key at all | `app/api/image/generate` builds the `image.pollinations.ai/prompt/{prompt}` URL server-side and returns the model catalogue |
| Server keys let a brand-new user build immediately | `lib/router/resolve-key.ts` falls back user → server → keyless → error; `/admin/keys` stores them; `pnpm db:seed` imports `DEFAULT_*_KEY` |
| Admin can promote, ban, analyse and toggle | 10 audited routes under `/api/admin/*`; pages for users, analytics, features, providers, moderation, audit, system |
| A user's own key wins for their own requests | Same resolver: the user row is consulted first and reported back in the SSE `meta` frame |
| Mobile drawer and bottom navigation | `components/studio/mobile-nav.tsx` (bottom bar) + `sidebar.tsx` drawer, driven by `stores/ui.ts` |
| Public routes stay public, gated routes redirect | smoke test: `/`, `/about`, `/pricing`, `/docs`, `/signin`, `/signup` → 200; `/studio`, `/dashboard`, `/admin/keys` → 307 to `/signin?callbackUrl=…`; unknown path → 404 (not a sign-in wall) |
| Health probe is honest about a broken deployment | `/api/health` → 503 with `database: false`, `encryption: true`, `rate_limit: true` (in-process fallback), `auth: true` |

## 6. Live preview pass (2026-10-07) — what running it actually found

The app was deployed locally against a real PostgreSQL 17 instance (`drizzle-kit push` → 19 tables, `scripts/seed.ts`),
sign-in was exercised over **https through a TLS-terminating proxy that emulates the preview host**, and every page was
driven in a real browser. Eight defects only a runtime pass can surface, all fixed:

| # | Symptom | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Usage meter showed `0 / 2.00M`, dashboard showed **$0.00** and **0 tokens** | `/api/me` returned `quotas: { maxTokensPerDay, … }` and `usage.totals` without `chats/projects/images` — the shape `useMe()` declares and every component reads | The route now returns pre-computed quota lines (`{used, max, remaining, percent}`) plus flattened `totals`/`today`, with the raw caps kept under `limits` |
| 2 | `totals` was **silently zero** even when the query ran | The new lifetime counts were raw `sql` subqueries; Drizzle rendered the columns unqualified (`on "chat_id" = "id"`), Postgres rejected it as ambiguous, and the caller's `.catch()` turned the error into zeros | Replaced with `db.$count()` + one explicit join in a typed `getUserEntityCounts()` helper |
| 3 | Settings status panel and the admin health chip read `undefined` | `/api/health` returned the ops shape (`checks.database.ok`), while `useHealth()` expects `{status, database, encryption, providers}` | The probe now returns **both**: the UI contract at the top level, the ops contract (`checks`, `providerDetail`) alongside |
| 4 | Every assistant code block rendered **`[object Object],`** | The `code` renderer did `String(children)`; once `rehype-highlight` runs, `children` is a tree of `<span>` tokens | Extract the source text from the parsed hast `node`, and hand the highlighted nodes to `CodeBlock` (which also means the hand-written `hljs` theme is now genuinely used) |
| 5 | Sign-in landed back on `/signin?error=unauthenticated`, then worked on any second navigation | `signIn(…, { redirect: false })` + client-side `router.push` can be served from the router's **prefetched** RSC payload, cached from the signed-out redirect | Hard navigation (`window.location.assign`) after a successful sign-in — one round trip, always sees the new cookie. Verified over https with `__Secure-` cookies |
| 6 | Generated apps went blank inside the live preview | The preview iframe is sandboxed **without** `allow-same-origin`, so any `localStorage` access throws `SecurityError` and kills the script | The coder prompt now requires try/catch (or a memory fallback) around every storage read/write, and the demo project in the seed data does it properly. **This was only half the story** — the pane stayed blank even for a storage-safe project, because of the layout defect described in §7 #9 |
| 7 | Gallery of past images was empty after a reload — `generated_images` was write-only | `GET /api/image/generate` returned the catalogue only; the gallery lived in a Zustand store | The endpoint now returns the user's last 20 generations and the studio hydrates from it (session images win the de-dupe) |
| 8 | Broken Pollinations images failed silently | Pollinations answers a throttled anonymous request with **HTTP 402** and an empty JSON body | The studio detects the failed load and says so, with a retry and the exact remedy (`POLLINATIONS_TOKEN`) |

### Provider reality check (same day)

`GET https://image.pollinations.ai/models` → **200** `["sana"]`, but
`GET https://image.pollinations.ai/prompt/…?width=512` from this host → **402** with body `{}`, with and without a
browser user-agent. The keyless image tier is therefore **IP-throttled**: it works from an ordinary residential
deployment and is refused from shared datacenter egress. The app handles both cases (it is a client-side image load,
so the request never fails the API), and the remedy is documented: set `POLLINATIONS_TOKEN` (or a `referrer`) for the
image endpoint. Chat is unaffected.

### Verified in the running app

| Surface | Evidence |
| --- | --- |
| Sign-in over https behind a proxy | `__Secure-authjs.session-token` issued, `/studio` reached, `/admin` rendered for the owner, **0 console errors** |
| Build pipeline output | Saved chat reopens with planner → coder → reviewer → fixer → enhancer → judge messages and a 3-file project |
| Live preview | iframe ran the generated timer: heading `Focus`, `#timer` = `25:00`, 1 711 chars of inlined CSS, **no error overlay** |
| Export paths | `exportZip` / `exportPdf` reachable from the project card (PDF via jsPDF + autotable) |
| Usage + analytics | `/api/me` totals 3 375 260 tokens / $14.66; admin analytics: 5 users, 203 requests, 14 daily buckets, 9 models |
| RBAC boundary | plain user → `/admin` 307 to `/studio?error=forbidden`, `/api/admin/*` 403 JSON; banned user → sign-in; anonymous API → 401 JSON |
| Admin panel | all nine pages rendered for the owner, attention queue populated, provider health showing one degraded and one down provider |
| Mobile | 390 × 844 studio layout captured with the drawer trigger visible |

## 7. Second runtime pass (2026-10-07) — silent zeros and a 3 400px iframe

Fixing the first eight defects exposed three more, each invisible to the type checker and to a screenshot:

| # | Symptom | Root cause | Fix |
| --- | --- | --- | --- |
| 9 | The live preview pane looked **empty** while its badge read `ready` | The shell was `min-h-screen` with an auto-height `<main>`, so `height: 100%` on the preview iframe resolved against a column that grew with the content. The iframe measured **3 391.7 px tall** and the generated app sat at y = 1 628 — below the fold. | `app-shell.tsx` is now `h-screen overflow-hidden` with `<main>` as the single scroll container; `chat-view.tsx` is `flex h-full min-h-0 flex-col`; the preview wrapper is `absolute inset-2` inside its scroll pane. The iframe is now 512.9 × 783 and the app renders in view. |
| 10 | Every assistant code block rendered `[object Object],` | The `code` renderer did `String(children)`, but after `rehype-highlight` runs `children` is a tree of `<span>` tokens | Read the source text from the parsed hast `node`, and pass the highlighted nodes to `CodeBlock` — which also means the hand-written `hljs` theme is finally doing something |
| 11 | Sidebar said "0 msg" for every chat; the admin user table said **$0.00** for users with real spend | A raw `sql` template renders its column references **unqualified**. `(select count(*) from messages where ${messages.chatId} = ${chats.id})` compiled to `where "chat_id" = "id"`, so Postgres resolved *both* sides inside the inner table — every row silently 0, no error. Same pattern in `listUsersWithStats` for tokens/cost/requests/chats. | Both rewritten as indexed `group by` aggregates merged in memory (`messageCount`, `projectCount`, `totalTokens`, `totalCost`, `totalRequests`, `chatCount`). Verified: 7/2/7/2 messages, $3.06–$14.66 per user. |

### Verified after the fixes

```
history  Focus timer            msgs=7 projects=1
         Explain CSS            msgs=2 projects=0
admin    demo@m1mods.dev    tokens=3 375 260  cost=$14.66  chats=4
         maya@example.com   tokens=  719 581  cost=$3.12   chats=0
preview  iframe 512.9 × 783 px · card at y=324 · heading "Focus" · timer "25:00"
```

`npx tsc --noEmit` → 0 errors · `npx vitest run` → 95/95 · `npx next build` → 47 routes · 12/12 browser checks · 21 screenshots with **zero console errors**.

## 8. Exposing the live preview (2026-10-07)

The sandbox preview proxies `0.0.0.0:<port>` to `https://<port>-<sandboxId>.e2b.app`, and the proxy renders the
app inside a pane. The app shipped `frame-ancestors 'none'` **and** `X-Frame-Options: DENY`, which is the right
default for production and a hard stop for any embedder — the operator would have seen an empty rectangle.

| Change | Detail |
| --- | --- |
| Framing is per request | `middleware.ts` now owns the CSP and the framing decision. Ordinary hosts (production included) still get `frame-ancestors 'none'` + `X-Frame-Options: DENY`; embed hosts get `frame-ancestors 'self' https://*.e2b.app` and **no** `X-Frame-Options` (it has no allow-list form). |
| Embed hosts | `*.e2b.app` by default, plus anything an operator lists in the optional `PREVIEW_EMBED_HOSTS` env var (comma-separated, suffix match). |
| One writer, one header | The CSP and `X-Frame-Options` entries were **removed** from `next.config.js`. Two components emitting the same header is how production gets relaxed by accident. |
| Verified | `curl -I -H 'Host: localhost:3000'` → `frame-ancestors 'none'` + `x-frame-options: DENY`. `curl -I -H 'Host: 3000-….e2b.app'` → `frame-ancestors 'self' https://*.e2b.app`, no `X-Frame-Options`. |

The preview is started with the same command the README documents, plus trusted-host derivation so the OAuth and
callback URLs follow whatever origin the proxy serves:

```
POSTGRES_URL="postgres://…" AUTH_SECRET="…" ENCRYPTION_KEY="…" AUTH_TRUST_HOST="true" \
  npx next build && npx next start -p 3000 -H 0.0.0.0
```

Leave `AUTH_URL` unset here: pinned to `http://localhost:3000` it makes Auth.js emit the wrong callback origin for
proxy traffic, while `AUTH_TRUST_HOST=true` derives it from `x-forwarded-host` and yields `__Secure-` cookies on the
https origin. Re-checked after the middleware change: sign-in over https → `/studio`, history lists the seeded chat,
`/admin` renders, **0 console errors**; 12/12 DOM checks and 21 screenshots still pass.
