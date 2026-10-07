import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Brain,
  Coins,
  Command,
  FileCode2,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Lock,
  ScanText,
  Shield,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/studio/logo';
import { MarketingFooter } from '@/components/marketing/footer';
import { ProviderMarquee } from '@/components/marketing/provider-marquee';
import { APP_NAME } from '@/lib/constants';

export const metadata = {
  title: `${APP_NAME} — nine providers, six agents, one studio`,
  description:
    'A production-grade multi-provider AI studio: chat and build with Z.ai, Gemini, OpenRouter, Groq, Cerebras, Mistral, DeepSeek, OpenAI and Pollinations — with a full admin panel, live preview and ZIP/PDF export.',
};

const FEATURES = [
  {
    icon: Layers,
    title: 'Nine providers, one endpoint',
    body: 'Z.ai, Google, OpenRouter, Groq, Cerebras, Mistral, DeepSeek, OpenAI and any custom OpenAI-compatible endpoint — routed server-side, so there is no CORS surface and no key ever reaches the browser.',
  },
  {
    icon: Brain,
    title: 'Automatic failover',
    body: 'A health-aware router walks a priority chain, hedges to a second provider after 6.5s, and benches a provider that returns 429s or dies mid-stream instead of failing your request.',
  },
  {
    icon: Wand2,
    title: 'Six-agent build pipeline',
    body: 'Planner → Coder → Reviewer → Fixer → Enhancer → Judge/Hardener. Each agent can be pinned to a different model, and the judge scores the result out of ten before you ever see it.',
  },
  {
    icon: FileCode2,
    title: 'Files, not code blocks',
    body: 'Every fenced block is parsed into a real project tree, a live preview is rendered in a sandboxed iframe, and you can export the whole thing as a ZIP or a typeset PDF.',
  },
  {
    icon: ImageIcon,
    title: 'Image Studio, zero keys',
    body: 'Pollinations image generation runs keyless, so a brand-new deployment can make pictures before anyone has configured a single provider.',
  },
  {
    icon: ScanText,
    title: 'Vision and local OCR',
    body: 'Drop a screenshot in to have a vision model read it, or run tesseract.js in the browser to extract exact text without uploading a byte.',
  },
  {
    icon: Shield,
    title: 'A real admin panel',
    body: 'Server keys, users, roles, bans, per-user quotas, feature flags, provider chains, moderation pattern blocks, audit log, analytics and a one-click database export.',
  },
  {
    icon: Coins,
    title: 'Honest cost tracking',
    body: 'Every request records tokens, provider, model and who paid for it. OpenRouter reports exact per-request cost; everything else uses a maintained pricing table.',
  },
  {
    icon: Lock,
    title: 'Keys encrypted at rest',
    body: 'AES-256-GCM with a per-row IV. The admin panel shows a masked hint and can probe a key — it can never read one back out.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Sign up',
    body: 'Google, GitHub or email + password. The first account matching OWNER_EMAIL is promoted to owner automatically.',
  },
  {
    step: '02',
    title: 'Add one key (admin)',
    body: 'Paste a server key for any provider. From that moment every user on the instance can generate — no setup for them at all.',
  },
  {
    step: '03',
    title: 'Build something',
    body: 'Describe an app. The pipeline plans it, writes it, reviews it, fixes what the reviewer found, then scores it.',
  },
  {
    step: '04',
    title: 'Ship it',
    body: 'Preview it live, then export ZIP for the tree or PDF for a shareable artifact.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-sm font-semibold tracking-tight">
              M1 <span className="brand-gradient-text">Mods</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-5 text-xs text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pipeline" className="transition-colors hover:text-foreground">
              Pipeline
            </a>
            <a href="#providers" className="transition-colors hover:text-foreground">
              Providers
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/studio">
                Open studio <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="brand-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <div className="flex flex-col items-center text-center">
              <Badge variant="default" className="mb-4">
                <Sparkles /> Multi-provider · Multi-agent · Self-hostable
              </Badge>

              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                One studio for <span className="brand-gradient-text">nine AI providers</span> and the six agents that
                turn a prompt into a project.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Chat with frontier models, or describe an app and watch a plan → code → review → fix → enhance → score
                pipeline build it. Live preview, ZIP and PDF export, keyless image generation, admin panel with server
                keys, roles, quotas and an audit log. Deployable to Vercel in one command.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/studio">
                    <Zap /> Start building
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#pipeline">See the pipeline</a>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Command className="size-3.5" /> Works with no keys at all (image studio)
                </span>
                <span className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5" /> Or bring your own
                </span>
                <span className="flex items-center gap-1.5">
                  <Gauge className="size-3.5" /> Streaming tokens and reasoning
                </span>
              </div>
            </div>

            <ProviderMarquee />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">Everything, actually implemented</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              No stubs, no placeholder screens. Every feature below ships as real code with the admin surface to
              operate it.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="panel panel-hover p-5">
                  <feature.icon className="size-4 text-brand" />
                  <h3 className="mt-3 text-sm font-medium">{feature.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">The six-agent pipeline</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Each stage is a separate call to a separately-chosen model. The router prefers a different provider for
              each role where it helps: a strong planner, a fast coder, a pedantic reviewer, a cheap fixer.
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Planner', body: 'Produces the file manifest, the data model and the implementation order. Output is short on purpose — it becomes the contract the coder follows.' },
                { name: 'Coder', body: 'Writes every file, one fenced block each, with a filename attribute so the parser can build a real tree instead of a guessing game.' },
                { name: 'Reviewer', body: 'Reads the code and answers either APPROVED or BUGS FOUND with a numbered defect list. Silent on trivia.' },
                { name: 'Fixer', body: 'Applies the reviewer’s defects to the exact files they were found in, changing nothing else.' },
                { name: 'Enhancer', body: 'Adds the polish that reviewers never ask for: empty states, keyboard handling, error boundaries, responsive layout.' },
                { name: 'Judge / Hardener', body: 'Scores the project out of ten and lists at most three remaining defects. Below the target score, the loop runs again.' },
              ].map((agent, index) => (
                <article key={agent.name} className="panel p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-[11px] font-semibold text-brand">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-medium">{agent.name}</h3>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{agent.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">From a fresh clone to a working build</h2>

            <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li key={item.step} className="panel p-5">
                  <span className="font-mono text-[11px] text-brand">{item.step}</span>
                  <h3 className="mt-2 text-sm font-medium">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Providers */}
        <section id="providers" className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">Providers</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Model catalogues are fetched live where the provider exposes a list, so a newly released model appears in
              the picker without a redeploy. Thinking modes, web search and vision are enabled per provider according to
              what that API actually supports.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Z.ai', body: 'GLM-5.3 family with native thinking toggles and a built-in web-search tool.' },
                { name: 'Google', body: 'Gemini 3.x through the OpenAI-compatible surface, with thinking_level control.' },
                { name: 'OpenRouter', body: 'Hundreds of models behind one key, with exact per-request cost reporting.' },
                { name: 'Groq', body: 'Extremely fast open-weight inference — the default for the coder role.' },
                { name: 'Cerebras', body: 'Two models, thousands of tokens per second. Ideal for reviewers and fixers.' },
                { name: 'Mistral', body: 'Large 4 and Codestral 25.08 for code-heavy work.' },
                { name: 'DeepSeek', body: 'Deep thinking with reasoning content surfaced in the thinking panel.' },
                { name: 'OpenAI', body: 'GPT-6 family with reasoning effort control.' },
                { name: 'Pollinations', body: 'Keyless text and image generation — the reason a fresh deploy still works.' },
              ].map((provider) => (
                <article key={provider.name} className="panel p-4">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-4 text-brand" />
                    <h3 className="text-sm font-medium">{provider.name}</h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{provider.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-border py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>

            <dl className="mt-6 space-y-5">
              {[
                {
                  q: 'Do I need an API key to start?',
                  a: 'For images, no — Pollinations is keyless. For chat and builds you need at least one key, either your own (Studio → API keys) or a shared server key that an admin adds in Admin → Keys. One server key unlocks the whole instance for every user.',
                },
                {
                  q: 'Where do my keys live?',
                  a: 'In your own Postgres database, encrypted with AES-256-GCM. The browser only ever receives a masked hint. Provider calls happen server-side, so keys are never exposed to the client and there is no CORS configuration to get wrong.',
                },
                {
                  q: 'What happens when a provider goes down?',
                  a: 'The router records the failure, benches that provider for a cooldown window, and continues down the chain. Mid-stream, a stalled provider is abandoned after 6.5s and the request is hedged to the next one — you keep your tokens and your answer.',
                },
                {
                  q: 'Can I self-host it?',
                  a: 'Yes. It is a standard Next.js app plus a Postgres database. Point POSTGRES_URL at any Postgres, set AUTH_SECRET and ENCRYPTION_KEY, and run it anywhere Node runs — Vercel, Docker, a VPS, your laptop.',
                },
                {
                  q: 'How do users get admin rights?',
                  a: 'Set OWNER_EMAIL before the first sign-up and that account is promoted to owner automatically. From then on the owner can promote others from Admin → Users; role changes and deletions are owner-only and audited.',
                },
              ].map((item) => (
                <div key={item.q} className="border-b border-border pb-5">
                  <dt className="text-sm font-medium">{item.q}</dt>
                  <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Users className="mx-auto size-6 text-brand" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">Ready when you are</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign up, or open the studio straight away — image generation works before anything is configured.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Create an account <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/studio">Open the studio</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
