'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Globe,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { notify } from '@/components/ui/toaster';
import { useAdminProviders } from '@/hooks/use-admin';
import { useProviders } from '@/hooks/use-providers';
import { AGENT_LABELS, type AgentId } from '@/lib/constants';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/**
 * Provider administration.
 *
 * Three jobs: enable/disable providers, pin a model per agent (the judge and the
 * coder rarely want the same model), and set the global fallback order. The order
 * matters more than anything else here — it is what decides which provider a
 * request hits first when several are healthy.
 */
export function ProvidersTable() {
  const admin = useAdminProviders();
  const { discover } = useProviders();
  const [discovering, setDiscovering] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);

  const [customName, setCustomName] = React.useState('');
  const [customBase, setCustomBase] = React.useState('');
  const [customKey, setCustomKey] = React.useState('');
  const [customModel, setCustomModel] = React.useState('');

  const move = (index: number, direction: -1 | 1) => {
    const order = admin.providers.map((provider) => provider.id);
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    admin.reorder.mutate(order, {
      onSuccess: () => notify.success('Fallback order updated.'),
      onError: (error) => notify.error('Reorder failed', errorMessage(error)),
    });
  };

  const runDiscover = async (provider: string) => {
    setDiscovering(provider);
    try {
      const result = await discover.mutateAsync({ provider });
      notify.success(`${result.count} models found for ${provider}`, `source: ${result.source}`);
      void admin.refetch();
    } catch (error) {
      notify.error('Discovery failed', errorMessage(error));
    } finally {
      setDiscovering(null);
    }
  };

  if (admin.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          loading={admin.isFetching}
          onClick={() => void admin.refetch()}
        >
          <RefreshCw /> Refresh health
        </Button>
        <Button size="sm" onClick={() => setCustomOpen(true)}>
          <Plus /> Add custom endpoint
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Anything OpenAI-compatible works: paste a base URL, a key and a model name.
        </p>
      </div>

      {/* Fallback order */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Workflow className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Fallback order</h2>
          <Badge variant="muted" className="ml-auto">
            left to right
          </Badge>
        </header>
        <ol className="flex flex-wrap gap-2">
          {admin.chain.map((entry, index) => (
            <li
              key={entry.id}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs',
                entry.enabled ? 'border-border bg-muted/30' : 'border-border/60 text-muted-foreground opacity-60',
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
              {entry.name}
              <span className="ml-1 flex flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Move ${entry.name} earlier`}
                >
                  <ArrowUp className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Move ${entry.name} later`}
                >
                  <ArrowDown className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The router walks this order, skipping providers that are disabled, cooling down, or have no usable key —
          then hedges to the next one if the first stalls for 6.5s.
        </p>
      </section>

      {/* Provider rows */}
      <div className="space-y-3">
        {admin.providers.map((provider) => (
          <section key={provider.id} className="rounded-lg border border-border bg-card p-4">
            <header className="flex flex-wrap items-center gap-3">
              <span className="size-3 rounded-full" style={{ backgroundColor: provider.color }} aria-hidden />
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  {provider.name}
                  {provider.free ? <Badge variant="success">free tier</Badge> : null}
                  {!provider.requiresKey ? <Badge variant="muted">keyless</Badge> : null}
                  {provider.vision ? <Badge variant="info">vision</Badge> : null}
                  {provider.supportsThinking ? <Badge variant="default">thinking</Badge> : null}
                  {provider.supportsWeb ? (
                    <Badge variant="muted">
                      <Globe /> web
                    </Badge>
                  ) : null}
                </h3>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{provider.baseUrl}</p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    provider.health.status === 'ok'
                      ? 'success'
                      : provider.health.status === 'cooling'
                        ? 'warning'
                        : provider.health.status === 'dead'
                          ? 'danger'
                          : 'muted'
                  }
                >
                  {provider.health.coolingDownMs > 0
                    ? `cooling ${Math.ceil(provider.health.coolingDownMs / 1000)}s`
                    : provider.health.lastLatencyMs
                      ? `${provider.health.lastLatencyMs}ms`
                      : provider.health.status}
                </Badge>

                <Badge variant={provider.serverKeyCount > 0 ? 'info' : 'muted'}>
                  {provider.serverKeyCount} key{provider.serverKeyCount === 1 ? '' : 's'}
                </Badge>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runDiscover(provider.id)}
                  disabled={discovering === provider.id}
                >
                  {discovering === provider.id ? <Loader2 className="animate-spin" /> : <Sparkles />} Models
                </Button>

                <Button size="sm" variant="outline" onClick={() => setEditing(editing === provider.id ? null : provider.id)}>
                  {editing === provider.id ? 'Close' : 'Configure'}
                </Button>

                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(enabled) =>
                    admin.update.mutate(
                      { provider: provider.id, enabled },
                      {
                        onSuccess: () => notify.success(`${provider.name} ${enabled ? 'enabled' : 'disabled'}.`),
                        onError: (error) => notify.error('Update failed', errorMessage(error)),
                      },
                    )
                  }
                  aria-label={`Enable ${provider.name}`}
                />
              </div>
            </header>

            {provider.health.lastError ? (
              <p className="mt-2 font-mono text-[10px] text-destructive">{provider.health.lastError}</p>
            ) : null}

            {editing === provider.id ? (
              <ProviderEditor
                provider={provider}
                agentIds={admin.agentIds}
                onSave={(patch, done) =>
                  admin.update.mutate(
                    { provider: provider.id, ...patch },
                    {
                      onSuccess: () => {
                        notify.success(`${provider.name} updated.`);
                        done();
                        setEditing(null);
                      },
                      onError: (error) => {
                        notify.error('Update failed', errorMessage(error));
                        done();
                      },
                    },
                  )
                }
              />
            ) : null}
          </section>
        ))}
      </div>

      {/* Custom endpoints */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Layers className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Custom endpoints</h2>
          <Badge variant="muted" className="ml-auto">
            {admin.customProviders.length}
          </Badge>
        </header>

        {admin.customProviders.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            None yet. Add any OpenAI-compatible endpoint (vLLM, LM Studio, a corporate gateway, Together, Fireworks…)
            and it becomes routable like a built-in provider.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {admin.customProviders.map((custom) => (
              <li key={custom.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{custom.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {custom.baseUrl} · {custom.defaultModel}
                  </p>
                </div>
                <Badge variant={custom.enabled ? 'success' : 'muted'}>{custom.enabled ? 'on' : 'off'}</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${custom.name}`}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {custom.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The endpoint and its stored key are deleted. Any request routed to it falls through to the next
                        provider.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() =>
                          admin.removeCustom.mutate(custom.id, {
                            onSuccess: () => notify.success('Custom endpoint removed.'),
                            onError: (error) => notify.error('Delete failed', errorMessage(error)),
                          })
                        }
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add custom dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a custom endpoint</DialogTitle>
            <DialogDescription>
              Any service that speaks the OpenAI chat-completions protocol. The key is encrypted like every other
              credential.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label required>Display name</Label>
              <Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Internal gateway" />
            </div>
            <div className="space-y-1.5">
              <Label required>Base URL</Label>
              <Input
                value={customBase}
                onChange={(event) => setCustomBase(event.target.value)}
                placeholder="https://llm.internal.example/v1"
              />
              <p className="text-[11px] text-muted-foreground">
                The app appends <span className="font-mono">/chat/completions</span> — include any prefix, but not that
                path.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label required>API key</Label>
              <Input
                type="password"
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="sk-…"
              />
            </div>
            <div className="space-y-1.5">
              <Label required hint="used when routing">
                Default model
              </Label>
              <Input
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                placeholder="qwen2.5-coder-32b-instruct"
              />
            </div>
          </div>

          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={admin.addCustom.isPending}
              onClick={() =>
                admin.addCustom.mutate(
                  {
                    name: customName.trim(),
                    baseUrl: customBase.trim(),
                    key: customKey.trim(),
                    defaultModel: customModel.trim(),
                  },
                  {
                    onSuccess: () => {
                      notify.success('Custom endpoint added.');
                      setCustomOpen(false);
                      setCustomName('');
                      setCustomBase('');
                      setCustomKey('');
                      setCustomModel('');
                    },
                    onError: (error) => notify.error('Could not add the endpoint', errorMessage(error)),
                  },
                )
              }
              disabled={!customName || !customBase || !customKey || !customModel}
            >
              <Check /> Add endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderEditor({
  provider,
  agentIds,
  onSave,
}: {
  provider: {
    id: string;
    defaultModel: string | null;
    models: { text: string[] };
    agentModels: Record<string, string> | null;
    rateLimit: number | null;
    notes: string | null;
  };
  agentIds: string[];
  onSave: (
    patch: {
      defaultModel?: string | null;
      rateLimit?: number | null;
      agentModels?: Record<string, string> | null;
      notes?: string | null;
    },
    done: () => void,
  ) => void;
}) {
  const [defaultModel, setDefaultModel] = React.useState(provider.defaultModel ?? '');
  const [rateLimit, setRateLimit] = React.useState(provider.rateLimit?.toString() ?? '');
  const [notes, setNotes] = React.useState(provider.notes ?? '');
  const [agentModels, setAgentModels] = React.useState<Record<string, string>>(provider.agentModels ?? {});
  const [saving, setSaving] = React.useState(false);

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label hint="used when auto-routing">Default model</Label>
          <Select
            value={defaultModel || '__auto__'}
            onValueChange={(value) => setDefaultModel(value === '__auto__' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provider default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Provider default</SelectItem>
              {provider.models.text.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label hint="requests / hour">Rate limit</Label>
          <Input
            inputMode="numeric"
            value={rateLimit}
            onChange={(event) => setRateLimit(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="unlimited"
          />
        </div>

        <div className="space-y-1.5">
          <Label hint="shown in the picker">Notes</Label>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cheap for bulk jobs" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-medium">
          Per-agent model pins
          <span className="text-[11px] font-normal text-muted-foreground">
            leave on “provider default” to let the router decide
          </span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agentIds.map((agent) => (
            <div key={agent} className="space-y-1">
              <Label className="text-[11px]">{AGENT_LABELS[agent as AgentId] ?? agent}</Label>
              <Select
                value={agentModels[agent] ?? '__auto__'}
                onValueChange={(value) =>
                  setAgentModels((current) => {
                    const next = { ...current };
                    if (value === '__auto__') delete next[agent];
                    else next[agent] = value;
                    return next;
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Provider default</SelectItem>
                  {provider.models.text.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        loading={saving}
        onClick={() => {
          setSaving(true);
          onSave(
            {
              defaultModel: defaultModel || null,
              rateLimit: rateLimit ? Number(rateLimit) : null,
              agentModels: Object.keys(agentModels).length > 0 ? agentModels : null,
              notes: notes || null,
            },
            () => setSaving(false),
          );
        }}
      >
        <Save /> Save provider
      </Button>
    </div>
  );
}
