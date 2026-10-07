import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * KPI tile used across the admin overview and analytics pages. The delta is
 * optional because most numbers here are cumulative rather than period-over-
 * period, and inventing a change indicator would be worse than omitting it.
 */
export function StatCard({
  label,
  value,
  sub,
  delta,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  icon?: ReactNode;
  tone?: 'default' | 'brand' | 'admin' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const toneRing = {
    default: 'border-border',
    brand: 'border-brand/40',
    admin: 'border-admin-700/60',
    success: 'border-emerald-500/40',
    warning: 'border-amber-500/40',
    danger: 'border-red-500/40',
  }[tone];

  const toneIcon = {
    default: 'text-muted-foreground',
    brand: 'text-brand',
    admin: 'text-admin-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  }[tone];

  return (
    <div className={cn('rounded-lg border bg-card p-4', toneRing, className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className={cn('[&_svg]:size-3.5', toneIcon)}>{icon}</span> : null}
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
        {typeof delta === 'number' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium',
              delta >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
