'use client';

import * as React from 'react';
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
import { Activity, Coins, Download, Gauge, TrendingDown, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatCard } from '@/components/admin/stat-card';
import { notify } from '@/components/ui/toaster';
import { useAdminAnalytics } from '@/hooks/use-admin';
import { downloadText } from '@/lib/utils/exporters';
import { formatCost, formatNumber, formatPercent, formatTokens } from '@/lib/utils/format';

const PIE_COLORS = ['#d97757', '#8b7bf0', '#5eb0ef', '#4ec9b0', '#e3a288', '#f2cc60'];

const CHART_TOOLTIP_STYLE = {
  background: '#262626',
  border: '1px solid #3a3a3a',
  borderRadius: 8,
  fontSize: 12,
  color: '#eee',
} as const;

/**
 * Analytics: totals, per-provider spend and latency percentiles, top models,
 * the daily series, cost per user and the user-vs-server billing split.
 *
 * Latency percentiles come from a rolling sample in the provider health table
 * (p50/p95/p99), which is what actually matters when picking a default provider:
 * averages hide the tail that users notice.
 */
export function AnalyticsView() {
  const [days, setDays] = React.useState('30');
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminAnalytics(Number(days));

  const exportCsv = () => {
    if (!data) return;
    const header = ['provider', 'requests', 'tokens', 'cost_usd', 'errors', 'error_rate', 'p50_ms', 'p95_ms', 'p99_ms'].join(',');
    const rows = data.providers.map((provider) =>
      [
        provider.provider,
        provider.requests,
        provider.tokens,
        provider.cost.toFixed(6),
        provider.errors,
        provider.errorRate.toFixed(4),
        provider.latency.p50,
        provider.latency.p95,
        provider.latency.p99,
      ].join(','),
    );
    downloadText([header, ...rows].join('\n'), `m1-analytics-${days}d.csv`, 'text/csv;charset=utf-8');
    notify.success('Analytics exported.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={days} onValueChange={(value) => value && setDays(value)} aria-label="Range">
          <ToggleGroupItem value="1">24h</ToggleGroupItem>
          <ToggleGroupItem value="7">7d</ToggleGroupItem>
          <ToggleGroupItem value="30">30d</ToggleGroupItem>
          <ToggleGroupItem value="90">90d</ToggleGroupItem>
          <ToggleGroupItem value="365">1y</ToggleGroupItem>
        </ToggleGroup>

        <div className="ml-auto flex items-center gap-2">
          {isFetching ? <Badge variant="muted">refreshing…</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="text-xs text-destructive">{error instanceof Error ? error.message : 'Could not load analytics.'}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Requests"
              value={formatNumber(data.totals.requests)}
              sub={`${formatNumber(data.overview.totalRequests)} all-time`}
              icon={<Zap />}
              tone="brand"
            />
            <StatCard
              label="Spend"
              value={formatCost(data.totals.cost)}
              sub={`avg ${formatCost(data.totals.avgCostPerRequest)} / request`}
              icon={<Coins />}
              tone="admin"
            />
            <StatCard
              label="Error rate"
              value={formatPercent(data.totals.errorRate)}
              sub={`${formatNumber(data.totals.errors)} failed requests`}
              icon={<TrendingDown />}
              tone={data.totals.errorRate > 0.1 ? 'danger' : 'success'}
            />
            <StatCard
              label="Active users"
              value={String(data.overview.active7d)}
              sub={`${data.overview.active24h} in the last 24h`}
              icon={<Users />}
            />
          </div>

          {/* Daily series */}
          <section className="rounded-lg border border-border bg-card p-4">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Requests & tokens per day</h2>
              <Badge variant="muted">{data.range.days} days</Badge>
            </header>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d97757" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#d97757" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="tokFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b7bf0" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#8b7bf0" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                  <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#d97757"
                    fill="url(#reqFill)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke="#8b7bf0"
                    fill="url(#tokFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            {/* Per-provider table with percentiles */}
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Gauge className="size-4 text-brand" />
                <h2 className="text-sm font-medium">Providers</h2>
                <Badge variant="muted" className="ml-auto">
                  {data.providers.length}
                </Badge>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>p50 / p95 / p99</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.providers.map((provider) => (
                    <TableRow key={provider.provider}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="text-sm">{provider.provider}</span>
                          <Badge
                            variant={
                              provider.status === 'ok'
                                ? 'success'
                                : provider.status === 'cooling'
                                  ? 'warning'
                                  : provider.status === 'dead'
                                    ? 'danger'
                                    : 'muted'
                            }
                          >
                            {provider.status}
                          </Badge>
                        </span>
                        {provider.lastError ? (
                          <span className="mt-0.5 block max-w-56 truncate font-mono text-[10px] text-destructive">
                            {provider.lastError}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatNumber(provider.requests)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTokens(provider.tokens)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCost(provider.cost)}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {provider.latency.p50 || '—'} / {provider.latency.p95 || '—'} / {provider.latency.p99 || '—'} ms
                      </TableCell>
                      <TableCell>
                        {provider.errors > 0 ? (
                          <Badge variant="danger">{formatPercent(provider.errorRate, 0)}</Badge>
                        ) : (
                          <Badge variant="success">0</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Billing split */}
            <section className="rounded-lg border border-border bg-card p-4">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Who pays</h2>
                <Badge variant="muted">user vs server keys</Badge>
              </header>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.billing.map((entry) => ({
                        name: entry.billingSource === 'server' ? 'Server keys' : 'User keys',
                        value: entry.requests,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {data.billing.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Requests served on your shared keys cost the instance; requests on a user's own key do not.
              </p>
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Top models */}
            <section className="rounded-lg border border-border bg-card p-4">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Top models</h2>
                <Activity className="size-4 text-muted-foreground" />
              </header>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.topModels.slice(0, 8).map((model) => ({
                      name: model.model.replace(/^.*\//, ''),
                      requests: model.requests,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.18)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="rgba(128,128,128,0.5)" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 10 }}
                      stroke="rgba(128,128,128,0.5)"
                    />
                    <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="requests" fill="#d97757" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Cost per user */}
            <section className="overflow-hidden rounded-lg border border-border bg-card">
              <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Coins className="size-4 text-brand" />
                <h2 className="text-sm font-medium">Cost per user</h2>
              </header>
              <div className="max-h-64 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.costPerUser.slice(0, 25).map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="max-w-48 truncate text-xs">{row.email}</TableCell>
                        <TableCell className="font-mono text-xs">{formatNumber(row.requests)}</TableCell>
                        <TableCell className="font-mono text-xs">{formatTokens(row.tokens)}</TableCell>
                        <TableCell className="font-mono text-xs">{formatCost(row.cost)}</TableCell>
                      </TableRow>
                    ))}
                    {data.costPerUser.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                          No usage in this window.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleString()} · per-day rows are aggregated from the usage table,
            which records the provider, model and billing source of every completed request.
          </p>
        </>
      )}
    </div>
  );
}
