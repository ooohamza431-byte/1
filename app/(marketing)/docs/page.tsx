import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Brain,
  Coins,
  Database,
  FileCode2,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Layers,
  ListChecks,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketingFooter } from '@/components/marketing/footer';
import { APP_NAME } from '@/lib/constants';

export const metadata = {
  title: `Docs — ${APP_NAME}`,
  description:
    'Install, configure and deploy M1 Mods MultiAgent: environment variables, database, owner bootstrap, provider keys, the six-agent pipeline, the admin panel and the API surface.',
};

/* ------------------------------------------------------------------ content */

const SECTIONS = [
  { id: 'quickstart', label: 'Quick start', icon: Rocket },
  { id: 'env', label: 'Environment', icon: ListChecks },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'owner', label: 'Owner bootstrap', icon: ShieldCheck },
  { id: 'keys', label: 'Keys & routing', icon: KeyRound },
  { id: 'pipeline', label: 'Build pipeline', icon: Brain },
  { id: 'studio', label: 'Studio tour', icon: Boxes },
  { id: 'admin', label: 'Admin panel', icon: Users },
  { id: 'api', label: 'API reference', icon: Terminal },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
] as const;

const ENV_VARS: { name: string; required: boolean; note: string }[] = [
  { name: 'POSTGRES_URL', required: true, note: 'Postgres connection string. The Neon/Vercel Marketplace integration injects this for you.' },
  { name: 'AUTH_SECRET', required: true, note: 'NextAuth v5 signing secret. Generate with `openssl rand -base64 32`.' },
  { name: 'ENCRYPTION_KEY', required: true, note: '64 hex characters (32 bytes) used for AES-256-GCM. Losing it means stored provider keys can never be decrypted.' },
  { name: 'NEXTAUTH_URL', required: true, note: 'The public origin, e.g. https://your-app.vercel.app. Must match the deployment URL exactly.' },
  { name: 'AUTH_URL', required: false, note: 'Optional alias for NEXTAUTH_URL on some hosts.' },
  { name: 'AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET', required: false, note: 'Enables Google sign-in. Set the redirect URI to https://your-domain/api/auth/callback/google.' },
  { name: 'AUTH_GITHUB_ID / AUTH_GITHUB_SECRET', required: false, note: 'Enables GitHub sign-in. Redirect URI: https://your-domain/api/auth/callback/github.' },
  { name: 'OWNER_EMAIL', required: false, note: 'This address is promoted to `owner` on first sign-in — the one bootstrap that cannot be done from the UI.' },
  { name: 'UPSTASH_REDIS_REST_URL / _TOKEN', required: false, note: 'Distributed rate limiting. Without it the app falls back to an in-process limiter, which is per-instance.' },
  { name: 'DEFAULT_*_KEY', required: false, note: 'Server keys imported into the admin panel by `pnpm db:seed`. The full set is DEFAULT_ZAI_KEY, DEFAULT_GOOGLE_KEY, DEFAULT_OPENROUTER_KEY, DEFAULT_GROQ_KEY, DEFAULT_CEREBRAS_KEY, DEFAULT_MISTRAL_KEY, DEFAULT_DEEPSEEK_KEY, DEFAULT_OPENAI_KEY and POLLINATIONS_TOKEN.' },
];

const PROVIDERS: { name: string; base: string; thinking: string; vision: string }[] = [
  { name: 'Z.ai (GLM)', base: 'api.z.ai/api/paas/v4', thinking: '`thinking.type` enabled/disabled', vision: 'GLM-4V / GLM-5V' },
  { name: 'Google Gemini', base: 'generativelanguage.googleapis.com/v1beta/openai', thinking: 'reasoning_effort / thinking_config', vision: 'Yes' },
  { name: 'OpenRouter', base: 'openrouter.ai/api/v1', thinking: 'model-dependent', vision: 'Yes' },
  { name: 'Groq', base: 'api.groq.com/openai/v1', thinking: 'reasoning models', vision: 'No' },
  { name: 'Cerebras', base: 'api.cerebras.ai/v1', thinking: 'gpt-oss reasoning', vision: 'No' },
  { name: 'Mistral', base: 'api.mistral.ai/v1', thinking: 'magistral family', vision: 'Pixtral / OCR' },
  { name: 'DeepSeek', base: 'api.deepseek.com/v1', thinking: 'thinking.enabled', vision: 'Flash models' },
  { name: 'OpenAI', base: 'api.openai.com/v1', thinking: 'reasoning_effort', vision: 'Yes' },
  { name: 'Pollinations', base: 'image.pollinations.ai (keyless)', thinking: 'n/a', vision: 'Image generation only' },
];

const ADMIN_PAGES: { href: string; label: string; permission: string; body: string }[] = [
  { href: '/admin', label: 'Overview', permission: 'analytics.read', body: 'An attention queue (down providers, missing server keys, failing keys, flagged messages, error-rate spikes) above KPIs, provider health and the newest accounts.' },
  { href: '/admin/keys', label: 'API keys', permission: 'keys.read', body: 'Server keys with masked display, live test, cooldown state, bulk import and per-provider enable/disable.' },
  { href: '/admin/users', label: 'Users', permission: 'users.read', body: 'Search and filter, per-user usage and cost, role changes, bans and cascading deletion.' },
  { href: '/admin/providers', label: 'Providers', permission: 'providers.write', body: 'Priority chain ordering, enable/disable, model allowlists, cooldowns, and custom OpenAI-compatible endpoints.' },
  { href: '/admin/features', label: 'Features', permission: 'features.write', body: '17 feature flags across generation, access and system groups, plus maintenance mode.' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics.read', body: 'Requests, tokens, latency percentiles, error rate, top models, daily trends, cost per user and billing split.' },
  { href: '/admin/moderation', label: 'Moderation', permission: 'moderation.read', body: 'Flagged messages, banned-pattern rules (regex or literal), and a CSV export of the message log.' },
  { href: '/admin/audit', label: 'Audit log', permission: 'audit.read', body: 'Every privileged action with actor, target, IP, user agent and a JSON diff.' },
  { href: '/admin/system', label: 'System', permission: 'system.write', body: 'Diagnostics (database, encryption, Upstash, OAuth, owner), editable system settings and a full JSON backup.' },
];

const API_ROUTES: { method: string; path: string; auth: string; body: string }[] = [
  { method: 'POST', path: '/api/chat', auth: 'user', body: 'SSE stream. Frames: meta, log, agent, delta, thinking, web, usage, files, error, done.' },
  { method: 'GET', path: '/api/providers', auth: 'user', body: 'Provider catalogue with capabilities, key source and the resolved routing chain.' },
  { method: 'POST', path: '/api/providers/test', auth: 'user', body: 'Liveness probe for one provider/model using the resolving key.' },
  { method: 'GET', path: '/api/models/discover', auth: 'user', body: 'Live model list pulled from a provider, with caching.' },
  { method: 'GET/PATCH/DELETE', path: '/api/keys', auth: 'user', body: 'Your own provider keys — list (masked), create, update, delete, plus a test verb.' },
  { method: 'POST', path: '/api/image/generate', auth: 'user', body: 'Pollinations image generation; returns the image URL and seed.' },
  { method: 'POST', path: '/api/vision', auth: 'user', body: 'Image understanding through a vision-capable provider, or client-side OCR fallback.' },
  { method: 'GET/POST/DELETE', path: '/api/history', auth: 'user', body: 'Chat and project history, with search.' },
  { method: 'GET', path: '/api/health', auth: 'public', body: 'Readiness probe: database, encryption and auth. Returns 503 until everything is configured.' },
  { method: '*', path: '/api/admin/*', auth: 'admin/owner', body: 'keys · users · providers · features · analytics · moderation · audit · system — every route permission-gated and audit-logged.' },
];

/* -------------------------------------------------------------- primitives */

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof Rocket;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-10">
      <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
        <span className="grid size-8 place-items-center rounded-md border border-border bg-card">
          <Icon className="size-4 text-brand" />
        </span>
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-md border border-border bg-[#141414] p-3.5 text-[11.5px] leading-relaxed text-neutral-300">
      <code>{children}</code>
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border">
            {head.map((cell) => (
              <th key={cell} className="p-3 text-left font-medium text-muted-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={index % 2 === 1 ? 'bg-card/40' : undefined}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="p-3 align-top text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------- page */

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <section className="dot-grid border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Badge variant="outline" className="mb-4">
            <ScrollText className="mr-1 size-3" /> Documentation
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight">
            From <span className="brand-gradient-text">git clone</span> to a deployed studio
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Everything an operator needs: environment variables, the database, the one-time owner bootstrap, provider
            keys, the six-agent pipeline, the admin panel and the full API surface.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
        {/* ------------------------------------------------------- quick start */}
        <Section id="quickstart" icon={Rocket} title="Quick start">
          <p>
            The repository is a single Next.js 15 App Router application. Clone it, install with pnpm, point it at a
            Postgres database, and run the dev server:
          </p>
          <Code>{`git clone https://github.com/your-org/m1-mods-multiagent.git
cd m1-mods-multiagent
pnpm install
cp .env.example .env.local      # then fill in the required values

pnpm db:push                    # create the 19 tables
pnpm db:seed                    # feature flags, provider chain, moderation rules
pnpm dev                        # http://localhost:3000`}</Code>
          <p>
            <strong className="text-foreground">Two required secrets.</strong> <code>AUTH_SECRET</code> signs sessions;{' '}
            <code>ENCRYPTION_KEY</code> encrypts provider keys with AES-256-GCM. Generate both before you start:
          </p>
          <Code>{`openssl rand -base64 32        # -> AUTH_SECRET
openssl rand -hex 32           # -> ENCRYPTION_KEY (64 hex characters)`}</Code>
          <p>
            A fresh install with no provider keys still works: the Image Studio uses the keyless Pollinations endpoint,
            and <code>/api/health</code> tells you exactly what is still missing.
          </p>
        </Section>

        {/* ------------------------------------------------------------ env */}
        <Section id="env" icon={ListChecks} title="Environment variables">
          <Table
            head={['Variable', 'Required', 'What it does']}
            rows={ENV_VARS.map((entry) => [
              <code key="name" className="text-foreground">
                {entry.name}
                {entry.required ? <span className="text-brand"> *</span> : null}
              </code>,
              entry.required ? <Badge variant="warning">required</Badge> : <Badge variant="muted">optional</Badge>,
              entry.note,
            ])}
          />
          <p>
            Database URLs are flexible: the client looks for <code>POSTGRES_URL</code>, then <code>DATABASE_URL</code>,
            then the unpooled variants that the Neon integration injects. Nothing connects at import time — the pool is
            created lazily on the first query, which is why the marketing pages render on a machine with no database.
          </p>
        </Section>

        {/* ------------------------------------------------------- database */}
        <Section id="database" icon={Database} title="Database">
          <p>
            Drizzle ORM over postgres.js, 19 tables, no ORM magic. <code>pnpm db:push</code> syncs the schema directly —
            the deploy pipeline runs it automatically after install, so a first deploy provisions itself.
          </p>
          <Code>{`pnpm db:push          # sync schema (used by the postinstall hook)
pnpm db:generate      # write a SQL migration into drizzle/migrations
pnpm db:migrate       # apply committed migrations instead of pushing
pnpm db:studio        # browse the data`}</Code>
          <p>
            Use <code>db:generate</code> + <code>db:migrate</code> once you have production data you care about; use{' '}
            <code>db:push</code> while the schema is still moving. The tables that matter most: <code>users</code>,{' '}
            <code>user_api_keys</code>, <code>server_api_keys</code>, <code>provider_configs</code>,{' '}
            <code>feature_flags</code>, <code>usage_stats</code>, <code>admin_audit_log</code>,{' '}
            <code>banned_patterns</code>, <code>provider_health</code>.
          </p>
        </Section>

        {/* ---------------------------------------------------------- owner */}
        <Section id="owner" icon={ShieldCheck} title="Owner bootstrap">
          <p>
            There are three roles — <code>user</code> → <code>admin</code> → <code>owner</code> — and 14 permissions
            mapped to the minimum role that may exercise them. Because promotion is itself a privileged action, the
            first owner has to come from somewhere outside the UI:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Set <code>OWNER_EMAIL</code> to your address, sign in once, and the account is promoted to <code>owner</code>{' '}
              on that first sign-in.
            </li>
            <li>
              Alternatively run the seed script with <code>OWNER_EMAIL</code> set: <code>pnpm db:seed</code> promotes an
              existing account with a matching address, or prints the exact SQL to run.
            </li>
          </ol>
          <p>
            From then on everything is in the UI: <code>/admin/users</code> changes roles, bans and deletes; the audit
            log records who did it, from which IP and with what payload. Two permissions are owner-only by design —{' '}
            <code>system.write</code> and <code>users.delete</code> — so an admin cannot quietly lock you out or wipe
            the database.
          </p>
        </Section>

        {/* ----------------------------------------------------------- keys */}
        <Section id="keys" icon={KeyRound} title="Keys & routing">
          <p>
            Key resolution order is fixed and is the reason a brand-new account can build immediately:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Your key</strong> from <code>/studio/keys</code>, decrypted
              server-side per request.
            </li>
            <li>
              <strong className="text-foreground">The admin&rsquo;s server key</strong> for that provider, if any.
            </li>
            <li>
              <strong className="text-foreground">A keyless provider</strong> (Pollinations) where the capability allows
              it.
            </li>
            <li>
              <strong className="text-foreground">A clear error</strong> naming the provider and telling you where to add
              a key — never a silent failure.
            </li>
          </ol>
          <p>
            Every call is made from a Node-runtime route handler, so no key reaches the browser and there is no CORS
            surface to configure. Keys are stored AES-256-GCM encrypted; the UI only ever shows a masked prefix. Storage
            in the environment variables above seeds the admin panel on first boot.
          </p>
          <Table
            head={['Provider', 'Base URL', 'Thinking / reasoning', 'Vision']}
            rows={PROVIDERS.map((provider) => [
              <span key="n" className="text-foreground">
                {provider.name}
              </span>,
              <code key="b">{provider.base}</code>,
              provider.thinking,
              provider.vision,
            ])}
          />
        </Section>

        {/* ------------------------------------------------------- pipeline */}
        <Section id="pipeline" icon={Brain} title="The six-agent build pipeline">
          <p>
            A build is not one model call. The router classifies the prompt, then specialised agents run in sequence —
            each one able to be pinned to a different provider and model:
          </p>
          <Table
            head={['Agent', 'Responsibility']}
            rows={[
              [<span key="1" className="text-foreground">Planner</span>, 'Turns the request into a file-by-file plan with a tech choice — no code yet.'],
              [<span key="2" className="text-foreground">Coder</span>, 'Writes the files as annotated fenced blocks (` ```html file="index.html" `).'],
              [<span key="3" className="text-foreground">Reviewer</span>, 'Reads the code back and answers APPROVED or BUGS FOUND with a numbered list.'],
              [<span key="4" className="text-foreground">Fixer</span>, 'Repairs exactly the reported defects and re-emits only the files it changed.'],
              [<span key="5" className="text-foreground">Enhancer</span>, 'Adds polish — accessibility, empty states, responsive behaviour — without changing intent.'],
              [<span key="6" className="text-foreground">Judge / Hardener</span>, 'Scores the build out of ten, lists defects, and loops the hardener until the target score is reached or the round cap is hit.'],
            ]}
          />
          <p>
            The Judge/Hardener pair runs only when you enable <strong className="text-foreground">Deep Harden</strong> in
            the composer, and never for a throwaway one-liner. Defaults live in <code>PIPELINE_DEFAULTS</code>: two
            rounds, target score 9/10, a 6.5s hedge delay, 240s request timeout and 32k output tokens.
          </p>
          <p>
            File parsing handles every fence dialect models produce — <code>```html file=&quot;index.html&quot;</code>,{' '}
            <code>```tsx App.tsx</code>, a <code>// file: path</code> comment on the first line, or a bare language fence
            whose filename is inferred. Paths are normalised and traversal segments are stripped, so an export can never
            write outside the archive.
          </p>
        </Section>

        {/* ---------------------------------------------------------- studio */}
        <Section id="studio" icon={Boxes} title="Studio tour">
          <Table
            head={['Route', 'What you get']}
            rows={[
              [<code key="1">/studio</code>, 'Chat mode with token-by-token streaming, collapsible thinking panels, web-search citations and a usage meter.'],
              [<code key="2">/studio/build</code>, 'Build mode: the live pipeline bar, per-agent steps, the project tree and a sandboxed preview of the generated app.'],
              [<code key="3">/studio/images</code>, 'Image Studio — keyless Pollinations generation, six style presets, six aspect presets, seeds, variations and one-click download.'],
              [<code key="4">/studio/history</code>, 'Every conversation and project, searchable, with restore and delete.'],
              [<code key="5">/studio/keys</code>, 'Your own provider keys, masked, with a live test button.'],
              [<code key="6">/studio/settings</code>, 'Theme (dark default, light, or follow the system), default models, streaming and prompt preferences.'],
              [<code key="7">/dashboard</code>, 'Your usage: requests, tokens, estimated cost, favourite models and recent projects.'],
            ]}
          />
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Every exported project can leave as a ZIP (JSZip + FileSaver) or a typeset PDF (jsPDF + autotable). Images
            can be read back in through a vision provider, or OCR&rsquo;d entirely in the browser with tesseract.js.
          </p>
        </Section>

        {/* ----------------------------------------------------------- admin */}
        <Section id="admin" icon={Users} title="Admin panel">
          <p>
            <code>/admin</code> is server-gated on <code>session.user.role</code> — a plain user is redirected to the
            studio, and every API route under <code>/api/admin/*</code> re-checks the permission server-side. Nothing is
            hidden-but-reachable.
          </p>
          <Table
            head={['Page', 'Permission', 'What it does']}
            rows={ADMIN_PAGES.map((page) => [
              <Link key="l" href={page.href} className="text-foreground hover:text-brand">
                {page.label}
              </Link>,
              <code key="p">{page.permission}</code>,
              page.body,
            ])}
          />
          <p className="flex items-start gap-2">
            <Gauge className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Analytics covers requests, tokens, latency percentiles (p50/p90/p99), error rate, top models, daily trends,
            cost per user and the split between user-funded and server-funded usage. Every privileged action lands in
            the audit log with actor, target, IP, user agent and a JSON diff.
          </p>
        </Section>

        {/* ------------------------------------------------------------- api */}
        <Section id="api" icon={Terminal} title="API reference">
          <p>
            All routes are Node-runtime, JSON in / JSON out, and rate-limited (100 requests per hour per identity via
            Upstash, with an in-process fallback). Streaming uses Server-Sent Events.
          </p>
          <Table
            head={['Method', 'Path', 'Auth', 'Notes']}
            rows={API_ROUTES.map((route) => [
              <Badge key="m" variant="outline">
                {route.method}
              </Badge>,
              <code key="p" className="text-foreground">
                {route.path}
              </code>,
              route.auth,
              route.body,
            ])}
          />
          <p>
            The chat stream emits <code>meta</code>, <code>log</code>, <code>agent</code>, <code>delta</code>,{' '}
            <code>thinking</code>, <code>web</code>, <code>usage</code>, <code>files</code>, <code>error</code> and{' '}
            <code>done</code> frames, with a heartbeat comment every 15 seconds so proxies never time the connection out.
          </p>
        </Section>

        {/* ---------------------------------------------------------- deploy */}
        <Section id="deploy" icon={Rocket} title="Deploy">
          <p>
            The repository ships a Vercel configuration and a build that only needs four environment variables. Use the
            Deploy button in the README, or the CLI:
          </p>
          <Code>{`pnpm dlx vercel link
pnpm dlx vercel env add POSTGRES_URL production
pnpm dlx vercel env add AUTH_SECRET production
pnpm dlx vercel env add ENCRYPTION_KEY production
pnpm dlx vercel env add NEXTAUTH_URL production
pnpm dlx vercel --prod`}</Code>
          <p>
            After the first deploy, install the Neon (or another) Postgres integration from the Vercel Marketplace — the
            connection string is injected as <code>POSTGRES_URL</code> and the schema is pushed automatically during the
            build. Then set <code>OWNER_EMAIL</code> to your address and sign in once.
          </p>
          <p className="flex items-start gap-2">
            <Layers className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Vercel Postgres was retired in 2024 and migrated to Neon, so this project never references it: any standard
            Postgres connection string works, pooled or unpooled.
          </p>
        </Section>

        {/* -------------------------------------------------- troubleshooting */}
        <Section id="troubleshooting" icon={Wrench} title="Troubleshooting">
          <Table
            head={['Symptom', 'Cause and fix']}
            rows={[
              [
                <code key="1">/api/health returns 503</code>,
                'One of database, encryption or auth is missing. The JSON body names which check failed — usually an unset ENCRYPTION_KEY or AUTH_SECRET.',
              ],
              [
                <code key="2">&quot;No provider available&quot;</code>,
                'No key resolves for the requested capability. Add your own key at /studio/keys, or ask an admin to store a server key at /admin/keys.',
              ],
              [
                <code key="3">Keys show as unreadable</code>,
                'The ENCRYPTION_KEY changed. Stored keys are AES-256-GCM sealed with it — re-enter the affected keys, or restore the original secret.',
              ],
              [
                <code key="4">A provider is skipped</code>,
                'It is cooling down after an error. /admin/providers shows the reason and lets you clear the cooldown after re-testing the key.',
              ],
              [
                <code key="5">Build stops mid-stream</code>,
                'The upstream provider dropped the connection. The router hedges to the next provider after 6.5s; partial files already streamed to the preview pane are kept.',
              ],
              [
                <code key="5b">Images return 402</code>,
                'Pollinations throttles the keyless image tier by IP — shared or datacenter egress is commonly refused with HTTP 402. Set POLLINATIONS_TOKEN for the image endpoint; chat is unaffected.',
              ],
              [
                <code key="5c">Preview pane is blank</code>,
                'The preview iframe is sandboxed without allow-same-origin, so localStorage throws inside generated apps. The coder prompt requires a try/catch fallback; a project that skips it will blank out.',
              ],
              [
                <code key="5e">The app refuses to be embedded</code>,
                'By design. Framing is decided per request in middleware.ts: ordinary hosts get frame-ancestors none + X-Frame-Options DENY, while preview hosts (*.e2b.app, or PREVIEW_EMBED_HOSTS) are allowed to frame it. Add your embedder there — not in next.config.js, which no longer emits either header.',
              ],
              [
                <code key="5d">A count or usage column reads 0</code>,
                'A raw SQL template renders column names without a table prefix, so a correlated subquery can compare two columns of the same table and silently match nothing. The queries in lib/db ship grouped aggregates instead — keep that shape when adding new ones.',
              ],
              [
                <code key="6">Rate limited at 100/hour</code>,
                'Expected default. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a distributed limiter, or adjust the window in lib/api/rate-limit.ts.',
              ],
              [
                <code key="7">Sign-in redirects in a loop</code>,
                'NEXTAUTH_URL does not match the real origin. Set it to the exact deployment URL, including the scheme.',
              ],
              [
                <code key="8">OAuth callback error</code>,
                'The redirect URI registered with Google/GitHub must be https://your-domain/api/auth/callback/google (or /github).',
              ],
            ]}
          />
          <p className="flex items-start gap-2">
            <FileCode2 className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Still stuck? Run <code>pnpm typecheck</code> and <code>pnpm test</code> first — the unit suite covers the
            parser, the classifier, cryptography, RBAC and the router, which is where most regressions show up.
          </p>
        </Section>

        <section className="panel brand-glow flex flex-col items-center gap-4 p-8 text-center">
          <Coins className="size-5 text-brand" />
          <h2 className="text-xl font-semibold tracking-tight">Ready to try it against a real provider?</h2>
          <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
            Create an account, or browse the plans if you would rather have someone else run the database and the server
            keys for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/signup">
                Create an account <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>
      </div>

      <MarketingFooter />
    </main>
  );
}
