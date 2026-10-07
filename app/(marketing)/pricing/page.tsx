import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  HelpCircle,
  Infinity as InfinityIcon,
  KeyRound,
  Minus,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketingFooter } from '@/components/marketing/footer';
import { APP_NAME } from '@/lib/constants';

export const metadata = {
  title: `Pricing — ${APP_NAME}`,
  description:
    'Self-host for free under the MIT licence, or run a managed instance. Bring your own provider keys, or let the admin supply server keys so new users can build with zero setup.',
};

interface Plan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  icon: typeof Rocket;
  highlight?: boolean;
  cta: { label: string; href: string };
  features: string[];
  footnote?: string;
}

const PLANS: Plan[] = [
  {
    id: 'self-host',
    name: 'Self-host',
    price: '$0',
    cadence: 'forever',
    tagline: 'The entire product, on your own infrastructure, under the MIT licence.',
    icon: Server,
    cta: { label: 'Read the docs', href: '/docs' },
    features: [
      'All nine providers + custom OpenAI-compatible endpoints',
      'Six-agent build pipeline with live preview',
      'Full admin panel: keys, users, features, analytics, moderation, audit',
      'Image Studio via keyless Pollinations',
      'ZIP and PDF export, OCR, vision',
      'Postgres, Drizzle, NextAuth v5 — your database, your data',
      'Unlimited seats, no per-token markup',
    ],
    footnote: 'You pay your chosen providers directly, at their list price.',
  },
  {
    id: 'managed',
    name: 'Managed',
    price: '$19',
    cadence: 'per user / month',
    tagline: 'We run the deployment, the database and the server keys.',
    icon: Sparkles,
    highlight: true,
    cta: { label: 'Start from the repo', href: '/signup' },
    features: [
      'Everything in Self-host, operated for you',
      'Shared server keys — new users build immediately, zero setup',
      'Per-user quotas, cost analytics and billing split',
      'Managed Postgres, backups and health monitoring',
      'Custom provider endpoints and model allowlists',
      'Priority support',
    ],
    footnote: 'Bring your own key at any time — your key always wins.',
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Talk to us',
    cadence: 'annual',
    tagline: 'For organisations that need governance on top of the studio.',
    icon: Building2,
    cta: { label: 'Compare the admin panel', href: '/docs#admin' },
    features: [
      'Everything in Managed',
      'Roles: user → admin → owner with 14 fine-grained permissions',
      'Full audit log of every privileged action',
      'Content moderation rules, banned patterns and CSV exports',
      'SSO-ready OAuth (Google, GitHub) plus credentials',
      'Self-hosted or private-cloud deployment',
      'Onboarding and migration assistance',
    ],
    footnote: 'Air-gapped and bring-your-own-database deployments available.',
  },
];

const COMPARISON: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: 'All nine providers', values: [true, true, true] },
  { label: 'Custom OpenAI-compatible endpoints', values: [true, true, true] },
  { label: 'Six-agent build pipeline', values: [true, true, true] },
  { label: 'Admin panel (keys, users, analytics)', values: [true, true, true] },
  { label: 'Server keys so new users need no setup', values: ['You supply', true, true] },
  { label: 'Hosting, Postgres and backups managed', values: [false, true, true] },
  { label: 'Per-user quotas and cost attribution', values: ['Manual', true, true] },
  { label: 'Audit log and moderation tooling', values: [true, true, true] },
  { label: 'SSO-ready OAuth', values: [true, true, true] },
  { label: 'Managed onboarding', values: [false, false, true] },
];

const FAQ = [
  {
    q: 'Do I need my own API keys to use this?',
    a: 'No. That is the point of the key resolution order: your own key first, then the admin\u2019s server key, then an error. If an administrator has stored a server key for at least one provider, a brand-new account can chat and build immediately with zero configuration. Pollinations image generation needs no key at all.',
  },
  {
    q: 'Where do my keys live?',
    a: 'Provider calls are made server-side, so no key ever reaches the browser and there is no CORS surface. User keys are encrypted with AES-256-GCM before they touch the database, and the admin panel shows only a masked prefix and the last four characters.',
  },
  {
    q: 'Can I disable a provider or a feature?',
    a: 'Yes. The admin panel exposes 17 feature flags plus per-provider toggles, priority ordering, model allowlists and cooldowns. Turning a provider off removes it from the routing chain for everyone, instantly.',
  },
  {
    q: 'Is there a payment provider in this repository?',
    a: 'No. The repository is MIT-licensed and ships no billing code \u2014 the tiers above describe what an operator can configure (or what a managed host would charge for). Self-hosting costs you nothing but your own provider spend.',
  },
  {
    q: 'What about a free tier with no account?',
    a: 'The free image generator via Pollinations is keyless, so a fresh deployment can produce images before any provider is configured. Chat and builds require an account so usage, quotas and the audit trail stay attributable.',
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes \u2014 there is a slide-in drawer, a bottom navigation bar and a responsive preview pane, so a build can be prompted from a phone and opened on a desktop.',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* ---------------------------------------------------------------- hero */}
      <section className="dot-grid border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <Badge variant="outline" className="mx-auto mb-5">
            <Coins className="mr-1 size-3" /> MIT licensed · self-hostable
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Pay for the tokens, not the wrapper
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {APP_NAME} is a multi-provider studio you can run yourself. There is no per-seat markup on your provider
            spend and no lock-in: bring your own keys, or let an administrator supply server keys so new accounts can
            build on day one.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Create an account <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">
                <Rocket className="size-4" /> Deploy it yourself
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- plans */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={
                  plan.highlight
                    ? 'panel brand-glow relative flex flex-col border-brand/40 p-6'
                    : 'panel flex flex-col p-6'
                }
              >
                {plan.highlight && (
                  <Badge className="absolute -top-2.5 left-6">
                    <Sparkles className="mr-1 size-3" /> Most popular
                  </Badge>
                )}

                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-md border border-border bg-card">
                    <Icon className="size-4 text-brand" />
                  </span>
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                </div>

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-xs text-muted-foreground">{plan.cadence}</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.tagline}</p>

                <Button
                  asChild
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="mt-5 w-full"
                >
                  <Link href={plan.cta.href}>{plan.cta.label}</Link>
                </Button>

                <ul className="mt-6 space-y-2.5 text-xs leading-relaxed">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.footnote && (
                  <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                    {plan.footnote}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-brand" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Key resolution order is fixed, and it favours you</p>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Your own stored key is tried first; only if you have none does the router fall back to the
                administrator&rsquo;s server key, then to a keyless provider, then to a clear error. Adding your key
                never changes anybody else&rsquo;s routing, and removing it never locks you out while server keys exist.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/docs#keys">
              How keys work <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ---------------------------------------------------------- comparison */}
      <section className="border-y border-border bg-card/20">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight">What is in every tier</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
            The application does not gate features behind a licence key — everything below ships in this repository.
          </p>

          <div className="panel mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left font-medium text-muted-foreground">Capability</th>
                  {PLANS.map((plan) => (
                    <th key={plan.id} className="p-3 text-center font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, index) => (
                  <tr key={row.label} className={index % 2 === 1 ? 'bg-card/40' : undefined}>
                    <td className="p-3 text-muted-foreground">{row.label}</td>
                    {row.values.map((value, cellIndex) => (
                      <td key={`${row.label}-${cellIndex}`} className="p-3 text-center">
                        {value === true ? (
                          <Check className="mx-auto size-4 text-brand" />
                        ) : value === false ? (
                          <Minus className="mx-auto size-4 text-muted-foreground/40" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{value}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ guarantees */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'No key ever reaches the browser',
              body: 'Every provider call is proxied through a Node-runtime route handler. Zero CORS configuration, zero exposed secrets, and a strict Content-Security-Policy on the app itself.',
            },
            {
              icon: InfinityIcon,
              title: 'No token caps we invented',
              body: 'Routing is health-aware and hedged, so a rate-limited or dying provider fails over to the next one in the chain instead of returning a 500 to your user.',
            },
            {
              icon: Users,
              title: 'Real administration',
              body: 'Roles, permissions, audit logging, moderation rules, per-user cost attribution and live provider health — not a settings screen bolted onto a demo.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="panel p-5">
                <Icon className="size-4 text-brand" />
                <h3 className="mt-3 text-sm font-medium">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------------ faq */}
      <section className="border-t border-border bg-card/20">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
            <HelpCircle className="size-5 text-brand" /> Questions people actually ask
          </h2>

          <div className="mt-8 space-y-3">
            {FAQ.map((entry) => (
              <details key={entry.q} className="panel group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                  {entry.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{entry.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ cta */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-14">
        <div className="panel brand-glow flex flex-col items-center gap-5 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Nine providers. Six agents. One studio.
          </h2>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Prompt it, watch six agents plan, code, review, fix, enhance and score your project, then run it in the
            preview pane and take it away as a ZIP or a PDF.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Start building <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/about">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
