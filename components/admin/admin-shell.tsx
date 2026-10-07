'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Database,
  Flag,
  KeyRound,
  LayoutDashboard,
  Menu,
  Settings2,
  ShieldAlert,
  Users,
  Workflow,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogoWordmark } from '@/components/studio/logo';
import { ThemeToggle } from '@/components/studio/theme-toggle';
import { useMe } from '@/hooks/use-me';
import { useHealth } from '@/hooks/use-health';
import { cn } from '@/lib/utils/cn';

/**
 * Admin console shell.
 *
 * Visually distinct from the studio on purpose (indigo accent + a permanent
 * banner) so nobody mistakes an admin view for their own workspace — several
 * pages here show other people's data.
 */

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true, permission: 'analytics.read' },
  { href: '/admin/keys', label: 'API keys', icon: KeyRound, permission: 'keys.read' },
  { href: '/admin/users', label: 'Users', icon: Users, permission: 'users.read' },
  { href: '/admin/providers', label: 'Providers', icon: Workflow, permission: 'providers.write' },
  { href: '/admin/features', label: 'Features', icon: Flag, permission: 'features.write' },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.read' },
  { href: '/admin/moderation', label: 'Moderation', icon: ShieldAlert, permission: 'moderation.read' },
  { href: '/admin/audit', label: 'Audit log', icon: Activity, permission: 'audit.read' },
  { href: '/admin/system', label: 'System', icon: Settings2, permission: 'system.write' },
] as const;

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useMe();

  return (
    <nav className="space-y-0.5 px-2" aria-label="Admin sections">
      {ADMIN_NAV.filter((item) => can(item.permission)).map((item) => {
        const active = 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-admin-700/40 text-admin-400'
                : 'text-muted-foreground hover:bg-admin-900/40 hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {active ? (
              <motion.span
                layoutId="admin-active"
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-admin-400"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);
  const { me, isOwner } = useMe();
  const { data: health } = useHealth();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-admin-800/60 bg-admin-950/60 lg:flex">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link href="/admin" className="inline-flex items-center gap-2">
            <LogoWordmark compact />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-admin-400">Admin</span>
          </Link>
        </div>

        <div className="mx-3 mb-3 rounded-md border border-admin-800/60 bg-admin-900/40 px-3 py-2">
          <p className="text-[11px] font-medium text-admin-400">Elevated session</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {me?.email ?? 'signed in'} · {me?.role ?? 'admin'}
            {isOwner ? ' (owner)' : ''}
          </p>
        </div>

        <AdminNav />

        <div className="mt-auto space-y-2 border-t border-admin-800/60 p-3">
          <Link
            href="/studio"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-admin-900/40 hover:text-foreground"
          >
            ← Back to studio
          </Link>
          {health ? (
            <div className="flex items-center gap-2 px-3 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  health.status === 'ok' ? 'bg-emerald-400' : health.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400',
                )}
              />
              {health.status} · {health.providers.usable} providers
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-admin-800/60 bg-admin-950/70 px-3 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open admin navigation">
            <Menu />
          </Button>

          <Badge variant="admin">ADMIN MODE</Badge>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Actions here are recorded in the audit log with your identity.
          </p>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/studio">Exit</Link>
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 border-admin-800/60 bg-admin-950/95 p-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex items-center gap-2 px-4 py-3">
            <LogoWordmark compact />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-admin-400">Admin</span>
          </div>
          <AdminNav onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
