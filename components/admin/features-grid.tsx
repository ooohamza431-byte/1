'use client';

import * as React from 'react';
import { Flag, Loader2, Megaphone, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { notify } from '@/components/ui/toaster';
import { useAdminFeatures } from '@/hooks/use-admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

const GROUP_META = {
  generation: {
    label: 'Generation',
    description: 'What users can do — build mode, vision, image generation, web search and the agent tricks.',
  },
  access: {
    label: 'Access',
    description: 'Who can get in and how — sign-ups, credential login, free-tier limits.',
  },
  system: {
    label: 'System',
    description: 'Instance-wide switches. Maintenance mode takes the whole app read-only.',
  },
} as const;

/**
 * Feature flags. Everything here is enforced server-side by `guardGeneration`,
 * so a toggle takes effect on the very next request — no redeploy.
 */
export function FeaturesGrid() {
  const { groups, maintenance, isLoading, toggle, bulk } = useAdminFeatures();
  const [pending, setPending] = React.useState<Record<string, boolean>>({});

  const set = (key: string, enabled: boolean) => {
    setPending((current) => ({ ...current, [key]: enabled }));
    toggle.mutate(
      { key, enabled },
      {
        onSuccess: () => {
          notify.success(`${key} ${enabled ? 'enabled' : 'disabled'}.`);
          setPending((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        },
        onError: (error) => {
          notify.error('Could not update the flag', errorMessage(error));
          setPending((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {maintenance ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          <Megaphone className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-medium">Maintenance mode is ON.</strong> Generation endpoints return 503 for every
            user except owners. Turn it off when you are done.
          </span>
        </div>
      ) : null}

      {(Object.keys(GROUP_META) as Array<keyof typeof GROUP_META>).map((group) => (
        <section key={group} className="space-y-3">
          <header>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Flag className="size-3.5 text-admin-400" />
              {GROUP_META[group].label}
              <Badge variant="admin">{groups[group].length}</Badge>
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{GROUP_META[group].description}</p>
          </header>

          <div className="grid gap-3 md:grid-cols-2">
            {groups[group].map((flag) => {
              const value = pending[flag.key] ?? flag.enabled;
              const isBusy = pending[flag.key] !== undefined;
              return (
                <div
                  key={flag.key}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors',
                    value ? 'border-brand/40 bg-brand/5' : 'border-border',
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {flag.meta?.label ?? flag.key}
                      {isBusy ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {flag.meta?.description ?? 'No description.'}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{flag.key}</p>
                  </div>
                  <Switch
                    checked={value}
                    onCheckedChange={(next) => set(flag.key, next)}
                    disabled={isBusy}
                    aria-label={`Toggle ${flag.key}`}
                  />
                </div>
              );
            })}
          </div>

          <Separator />
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          loading={bulk.isPending}
          onClick={() =>
            bulk.mutate(
              Object.fromEntries(groups.generation.map((flag) => [flag.key, true])),
              {
                onSuccess: () => notify.success('All generation features enabled.'),
                onError: (error) => notify.error('Bulk update failed', errorMessage(error)),
              },
            )
          }
        >
          <Save /> Enable all generation features
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Flags are stored in the database and read on every request, so changes apply immediately.
        </p>
      </div>
    </div>
  );
}
