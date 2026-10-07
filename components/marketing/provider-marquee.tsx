import { PROVIDER_META } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

/**
 * Provider strip under the hero. Rendered as a static grid rather than an
 * infinite marquee: the list is short, it is more legible, and it avoids an
 * animation that fights with reduced-motion settings.
 */
export function ProviderMarquee({ className }: { className?: string }) {
  const providers = Object.entries(PROVIDER_META).map(([id, meta]) => ({ id, ...meta }));

  return (
    <div className={cn('mt-12', className)}>
      <p className="text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Works with
      </p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: provider.color }} aria-hidden />
            {provider.name}
            {provider.free ? (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">free</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
