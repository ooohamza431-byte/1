import Link from 'next/link';
import { ArrowLeft, Boxes, Cpu, Lock, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoWordmark } from '@/components/studio/logo';
import { MarketingFooter } from '@/components/marketing/footer';
import { APP_NAME } from '@/lib/constants';

export const metadata = {
  title: 'About',
  description: `How ${APP_NAME} is put together — architecture, security model and the reasoning behind the routing layer.`,
};

const STACK = [
  ['Framework', 'Next.js 15 (App Router) · React 19 · TypeScript strict'],
  ['Styling', 'Tailwind CSS 3.4 · shadcn/ui primitives · Framer Motion · lucide-react'],
  ['Data', 'PostgreSQL with Drizzle ORM — 19 tables, typed end to end'],
  ['Auth', 'Auth.js (NextAuth v5) with Google, GitHub and credentials'],
  ['State', 'Zustand for live session state · TanStack Query for server state'],
  ['Docs & export', 'react-markdown + rehype-highlight · jsPDF · JSZip · file-saver'],
  ['Vision', 'tesseract.js in the browser + provider vision models server-side'],
  ['Rate limiting', 'Upstash sliding window with an in-process fallback'],
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href="/">
            <LogoWordmark />
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/">
              <ArrowLeft /> Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <Badge variant="default" className="mb-4">
          <Sparkles /> About
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A multi-provider AI studio built as a single deployable application: chat, a six-agent build pipeline,
          keyless image generation, and an administration layer complete enough to hand to a team. Everything runs
          server-side where it touches a provider, and everything that mutates data is validated with Zod and recorded
          in an audit log.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Cpu className="size-4 text-brand" /> Architecture
          </h2>
          <div className="panel overflow-hidden">
            <dl className="divide-y divide-border">
              {STACK.map(([label, value]) => (
                <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Boxes className="size-4 text-brand" /> How routing works
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Every request is classified first — is this a chat or a build, how complex is it, does it need vision or
              web search — and that classification decides which agents run and which providers are eligible. A chain is
              then built from the provider list: configured order first, then live health, then observed latency, with
              anything in cooldown pushed to the back rather than removed.
            </p>
            <p>
              Keys resolve as: your own key, then an admin&apos;s shared server key, then a keyless provider if one can
              serve the request. If nothing can serve it, you get a clear error naming the providers that were skipped
              and why, instead of a silent failure.
            </p>
            <p>
              While a response streams, the chain stays live. If the first provider stalls for 6.5 seconds, a second is
              started in parallel and whichever produces the first token wins — the loser is abandoned and its
              attribution is dropped, so usage numbers stay honest.
            </p>
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Lock className="size-4 text-brand" /> Security model
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li className="flex gap-2">
              <Shield className="mt-0.5 size-4 shrink-0 text-brand" />
              Provider credentials are encrypted with AES-256-GCM (per-row IV and auth tag) before they reach the
              database, and are never returned to the browser.
            </li>
            <li className="flex gap-2">
              <Shield className="mt-0.5 size-4 shrink-0 text-brand" />
              Every generation route is authenticated, feature-flag gated, rate limited and checked against per-user
              daily quotas before it spends a token.
            </li>
            <li className="flex gap-2">
              <Shield className="mt-0.5 size-4 shrink-0 text-brand" />
              Generated code is previewed in a sandboxed iframe without <code className="font-mono">allow-same-origin</code>, so it can
              never reach your session.
            </li>
            <li className="flex gap-2">
              <Shield className="mt-0.5 size-4 shrink-0 text-brand" />
              Roles are enforced server-side. The UI hides what you cannot do; the API refuses it regardless.
            </li>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/studio">Open the studio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Create an account</Link>
          </Button>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
