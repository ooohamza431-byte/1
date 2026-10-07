'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Flag,
  KeyRound,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/admin/stat-card';
import { useAdminAnalytics, useAdminKeys, useAdminUsers } from '@/hooks/use-admin';
import { useHealth } from '@/hooks/use-health';
import { formatCost, formatNumber, formatPercent, formatTokens, timeAgo } from '@/lib/utils/format';

/**
 * Admin landing page.
 *
 * Ordered by what an operator actually needs to know first: is the instance
 * healthy, is generation possible at all (are there keys?), who is using it, and
 * what needs attention right now.
 */
export function AdminOverview() {
  const analytics = useAdminAnalytics(7);
  const keys = useAdminKeys();
  const users = useAdminUsers();
  const health = useHealth();

  const overview = analytics.data?.overview;

  const attention: Array<{ label: string; detail: string; href: string; tone: 'danger' | 'warning' | 'info' }> = [];

  if (health.data && health.data.status === 'down') {
    attention.push({
      label: 'The deployment cannot generate',
      detail: health.data.database.ok ? 'Check provider keys and the encryption key.' : 'The database is unreachable.',
      href: '/admin/system',
      tone: 'danger',
    });
  }
  if (keys.data && keys.data.keys.length === 0) {
    attention.push({
      label: 'No server keys configured',
      detail: 'New users cannot build until you add at least one provider key.',
      href: '/admin/keys',
      tone: 'warning',
    });
  }
  if (keys.data && keys.data.keys.some((key) => key.testStatus === 'fail')) {
    attention.push({
      label: 'Some keys are failing',
      detail: `${keys.data.keys.filter((key) => key.testStatus === 'fail').length} key(s) failed their last probe.`,
      href: '/admin/keys',
      tone: 'warning',
    });
  }
  if (overview && overview.flaggedMessages > 0) {
    attention.push({
      label: 'Flagged messages need review',
      detail: `${overview.flaggedMessages} message(s) are flagged.`,
      href: '/admin/moderation',
      tone: 'info',
    });
  }
  if (analytics.data && analytics.data.totals.errorRate > 0.1) {
    attention.push({
      label: 'High provider error rate',
      detail: `${formatPercent(analytics.data.totals.errorRate)} of requests failed in the last 7 days.`,
      href: '/admin/providers',
      tone: 'warning',
    });
  }

  if (analytics.isLoading) {
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
    <div className="space-y-6">
      {/* Attention queue */}
      {attention.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-amber-400" />
            Needs attention
          </h2>
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 transition-colors hover:border-brand/40"
                >
                  <Badge
                    variant={item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'info'}
                  >
                    {item.tone}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.detail}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="size-4" />
          Everything looks healthy — keys are live, no flagged messages, error rate nominal.
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={formatNumber(overview?.totalUsers ?? 0)}
          sub={`${overview?.active24h ?? 0} active in 24h`}
          icon={<Users />}
          tone="admin"
        />
        <StatCard
          label="Requests today"
          value={formatNumber(overview?.requestsToday ?? 0)}
          sub={`${formatTokens(overview?.tokensToday ?? 0)} tokens`}
          icon={<Zap />}
          tone="brand"
        />
        <StatCard
          label="Spend today"
          value={formatCost(overview?.costToday ?? 0)}
          sub={`${formatCost(overview?.totalCost ?? 0)} lifetime`}
          icon={<Coins />}
        />
        <StatCard
          label="Server keys"
          value={formatNumber(overview?.enabledServerKeys ?? 0)}
          sub={keys.data && keys.data.keys.length > 0 ? `${keys.data.keys.length} stored` : 'none yet'}
          icon={<KeyRound />}
          tone={(overview?.enabledServerKeys ?? 0) > 0 ? 'success' : 'warning'}
        />
      </section>

      {/* Provider health snapshot */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Provider health</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/providers">Configure</Link>
          </Button>
        </header>

        {analytics.data ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.data.providers.slice(0, 9).map((provider) => (
              <li key={provider.provider} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="flex items-center gap-2 text-xs font-medium">
                  {provider.provider}
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
                    className="ml-auto"
                  >
                    {provider.status}
                  </Badge>
                </p>
                <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Activity className="size-3" />
                  p95 {provider.latency.p95 || '—'}ms · {formatNumber(provider.requests)} req ·{' '}
                  {formatPercent(provider.errorRate, 0)} err
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Newest users */}
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Users className="size-4 text-admin-400" />
          <h2 className="text-sm font-medium">Newest users</h2>
          <Button asChild size="sm" variant="ghost" className="ml-auto">
            <Link href="/admin/users">Manage all</Link>
          </Button>
        </header>
        <ul className="divide-y divide-border">
          {(users.users ?? []).slice(0, 6).map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{user.name ?? user.email}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user.email} · joined {timeAgo(user.createdAt)}
                </span>
              </span>
              <Badge variant={user.role === 'admin' ? 'admin' : user.role === 'owner' ? 'default' : 'muted'}>
                {user.role}
              </Badge>
              {user.banned ? <Badge variant="danger">banned</Badge> : null}
              <span className="font-mono text-[11px] text-muted-foreground">{formatCost(user.totalCost)}</span>
            </li>
          ))}
          {(users.users ?? []).length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No users yet.</li>
          ) : null}
        </ul>
      </section>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/keys', label: 'Add a server key', icon: KeyRound, description: 'Unlock generation for everyone' },
          { href: '/admin/features', label: 'Toggle features', icon: Flag, description: 'Kill switches and beta gates' },
          { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert, description: 'Block patterns, review flags' },
          { href: '/admin/audit', label: 'Audit log', icon: Activity, description: 'Who changed what, and when' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-admin-700 hover:bg-admin-900/20"
          >
            <action.icon className="size-4 text-admin-400" />
            <p className="mt-2 text-sm font-medium">{action.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{action.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
