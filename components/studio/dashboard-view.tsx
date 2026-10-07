'use client';

import * as React from 'react';
import Link from 'next/link';
import { Activity, Coins, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useMe } from '@/hooks/use-me';
import { useHistory } from '@/hooks/use-history';
import { useProviders } from '@/hooks/use-providers';
import { formatCost, formatNumber, formatTokens, timeAgo, truncate } from '@/lib/utils/format';

const PIE_COLORS = ['#d97757', '#8b7bf0', '#5eb0ef', '#4ec9b0', '#e3a288', '#f2cc60', '#ff7b72', '#c5b3ff'];

/**
 * Personal dashboard.
 *
 * All numbers are computed server-side; the charts only visualise them. Per-
 * provider spend comes from the usage table, which records the provider that
 * actually served each request — useful when a "free" provider starts costing
 * money, or when one key is quietly carrying all the traffic.
 */
export function DashboardView() {
  const { totals, quotas, isLoading } = useMe();
  const { chats } = useHistory({ limit: 8 });
  const { providers, usable } = useProviders();

  const providerData = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const chat of chats) counts.set(chat.mode ?? 'chat', (counts.get(chat.mode ?? 'chat') ?? 0) + 1);
    return [...counts.entries()].map(([name, value], index) => ({
      name,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }));
  }, [chats]);

  const daily = React.useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return {
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          tokens: 0,
          requests: 0,
        };
      }),
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Sparkles />}
          label="Tokens today"
          value={quotas ? formatTokens(quotas.tokens.used) : '—'}
          sub={quotas ? `of ${formatTokens(quotas.tokens.max)}` : undefined}
        />
        <StatCard
          icon={<Activity />}
          label="Builds today"
          value={quotas ? String(quotas.builds.used) : '—'}
          sub={quotas ? `of ${quotas.builds.max}` : undefined}
        />
        <StatCard
          icon={<Coins />}
          label="Lifetime cost"
          value={totals ? formatCost(totals.cost) : '—'}
          sub={totals ? `${formatNumber(totals.tokens)} tokens` : undefined}
        />
        <StatCard
          icon={<TrendingUp />}
          label="Ready providers"
          value={String(usable.length)}
          sub={`${providers.length} configured`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Usage</h2>
            <Badge variant="muted">last 7 days</Badge>
          </header>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97757" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#d97757" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <ChartTooltip
                  contentStyle={{
                    background: '#262626',
                    border: '1px solid #3a3a3a',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#eee',
                  }}
                />
                <Area type="monotone" dataKey="tokens" stroke="#d97757" fill="url(#tokenFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Per-day totals are recorded per request, including which provider served it, so this chart updates the
            moment a generation finishes.
          </p>
        </section>

        <section className="panel p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Conversation mix</h2>
          </header>
          {providerData.length === 0 ? (
            <EmptyState compact title="No conversations yet" description="Your mode split (chat vs build) shows here." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={providerData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                    {providerData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ChartTooltip
                    contentStyle={{
                      background: '#262626',
                      border: '1px solid #3a3a3a',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#eee',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Provider availability */}
      <section className="panel p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Provider availability</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/studio/settings">Manage</Link>
          </Button>
        </header>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={providers.map((provider) => ({
                name: provider.name,
                latency: provider.health.lastLatencyMs ?? 0,
                usable: provider.usable ? 1 : 0,
              }))}
              margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" interval={0} angle={-18} dy={8} />
              <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
              <ChartTooltip
                contentStyle={{
                  background: '#262626',
                  border: '1px solid #3a3a3a',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#eee',
                }}
              />
              <Bar dataKey="latency" fill="#8b7bf0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last observed latency per provider. A provider in cooldown is skipped by the router until its window expires.
        </p>
      </section>

      {/* Recent chats */}
      <section className="panel overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Recent conversations</h2>
          <Button asChild size="sm" variant="ghost" className="ml-auto">
            <Link href="/studio/history">View all</Link>
          </Button>
        </header>
        {chats.length === 0 ? (
          <EmptyState
            compact
            title="Nothing yet"
            description="Your conversations appear here with their token and cost totals."
          />
        ) : (
          <ul className="divide-y divide-border">
            {chats.slice(0, 6).map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/studio/${chat.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{truncate(chat.title || 'Untitled', 60)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {timeAgo(chat.updatedAt)} · {chat.messageCount} messages
                    </span>
                  </span>
                  {chat.projectCount > 0 ? <Badge variant="default">{chat.projectCount} project</Badge> : null}
                  {chat.totalCost ? <span className="font-mono text-[11px]">{formatCost(chat.totalCost)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="text-brand [&_svg]:size-3.5">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
