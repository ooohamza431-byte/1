'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  KeyRound,
  Loader2,
  Play,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { StatCard } from '@/components/admin/stat-card';
import { notify } from '@/components/ui/toaster';
import { useAdminKeys } from '@/hooks/use-admin';
import { useProviders } from '@/hooks/use-providers';
import { errorMessage } from '@/lib/api/client';
import { formatNumber, timeAgo } from '@/lib/utils/format';

/**
 * Server key management — the feature that makes a fresh deploy usable by a
 * brand-new account with zero setup. Adding one key here unlocks every provider
 * for every user immediately; the router then prefers each user's own key when
 * they have one.
 */
export function KeysTable() {
  const { keys, counts, isLoading, encryptionConfigured, add, bulkImport, update, remove, test } = useAdminKeys();
  const { providers } = useProviders();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'single' | 'bulk'>('single');
  const [provider, setProvider] = React.useState('');
  const [keyValue, setKeyValue] = React.useState('');
  const [bulkValue, setBulkValue] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [priority, setPriority] = React.useState('100');
  const [quota, setQuota] = React.useState('');
  const [testingId, setTestingId] = React.useState<string | null>(null);

  const keyedProviders = providers.filter((item) => item.requiresKey);
  const healthy = keys.filter((key) => key.testStatus === 'pass').length;
  const failing = keys.filter((key) => key.testStatus === 'fail').length;

  const resetForm = () => {
    setKeyValue('');
    setBulkValue('');
    setLabel('');
    setPriority('100');
    setQuota('');
  };

  const submit = async () => {
    if (!provider) {
      notify.error('Choose a provider first.');
      return;
    }

    try {
      if (mode === 'bulk') {
        const result = await bulkImport.mutateAsync({
          provider,
          keys: bulkValue,
          label: label.trim() || undefined,
          priority: Number(priority) || 100,
        });
        notify.success(
          `${result.imported} key${result.imported === 1 ? '' : 's'} imported`,
          result.failed > 0 ? `${result.failed} failed — check the format.` : undefined,
        );
      } else {
        if (keyValue.trim().length < 8) {
          notify.error('That key looks too short.');
          return;
        }
        await add.mutateAsync({
          provider,
          key: keyValue.trim(),
          label: label.trim() || undefined,
          priority: Number(priority) || 100,
          quota: quota ? Number(quota) : null,
        });
        notify.success(`${provider} key added`, 'Every user can now use this provider.');
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      notify.error('Could not save the key', errorMessage(error));
    }
  };

  const runTest = (id: string) => {
    setTestingId(id);
    test.mutate(id, {
      onSuccess: (result) =>
        result.ok
          ? notify.success('Key is live', `${result.latencyMs}ms · ${result.remainingHealthyKeys} healthy key(s) left`)
          : notify.error('Key failed', result.error ?? undefined),
      onError: (error) => notify.error('Probe failed', errorMessage(error)),
      onSettled: () => setTestingId(null),
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stored keys" value={String(keys.length)} icon={<KeyRound />} tone="admin" />
        <StatCard label="Healthy" value={String(healthy)} icon={<Check />} tone="success" />
        <StatCard label="Failing" value={String(failing)} icon={<X />} tone={failing > 0 ? 'danger' : 'default'} />
        <StatCard
          label="Providers covered"
          value={String(Object.keys(counts).length)}
          sub={`of ${keyedProviders.length} that need keys`}
          tone="brand"
        />
      </div>

      {!encryptionConfigured ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-medium">ENCRYPTION_KEY is missing.</strong> Keys cannot be stored or decrypted.
            Generate one with <code className="font-mono">openssl rand -hex 32</code>, add it to your environment and
            redeploy. Existing ciphertext written under a different key will need to be re-entered.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus /> Add key
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setMode('bulk');
            setDialogOpen(true);
          }}
        >
          <ClipboardPaste /> Bulk import
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Keys are encrypted with AES-256-GCM before insert and are only ever shown masked.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title="No server keys yet"
          description="Without a server key, users must add their own provider key before they can generate anything. Add one key here and the whole instance works immediately — that is what makes a fresh deploy usable out of the box."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus /> Add the first key
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const providerMeta = providers.find((item) => item.id === key.provider);
                const quotaPercent = key.quota ? Math.min(100, (key.used / key.quota) * 100) : 0;
                return (
                  <TableRow key={key.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: providerMeta?.color ?? '#888' }}
                          aria-hidden
                        />
                        <span className="font-medium">{providerMeta?.name ?? key.provider}</span>
                      </span>
                      {key.label ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{key.label}</span>
                      ) : null}
                    </TableCell>

                    <TableCell className="font-mono text-[11px]">{key.hint ?? '••••'}</TableCell>

                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            key.testStatus === 'pass'
                              ? 'success'
                              : key.testStatus === 'fail'
                                ? 'danger'
                                : 'muted'
                          }
                        >
                          {key.testStatus === 'pass' ? <Check /> : key.testStatus === 'fail' ? <X /> : null}
                          {key.testStatus ?? 'untested'}
                        </Badge>
                        {!key.enabled ? <Badge variant="muted">disabled</Badge> : null}
                        {key.testLatencyMs ? (
                          <span className="font-mono text-[10px] text-muted-foreground">{key.testLatencyMs}ms</span>
                        ) : null}
                      </span>
                      {key.lastError ? (
                        <span className="mt-1 block max-w-64 truncate font-mono text-[10px] text-destructive">
                          {key.lastError}
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="font-mono text-xs">{key.priority}</TableCell>

                    <TableCell className="text-xs">
                      <span className="font-mono">{formatNumber(key.used)}</span>
                      {key.quota ? (
                        <>
                          <span className="text-muted-foreground"> / {formatNumber(key.quota)}</span>
                          <span className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-brand"
                              style={{ width: `${quotaPercent}%` }}
                            />
                          </span>
                        </>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-[11px] text-muted-foreground">
                      {key.lastUsedAt ? timeAgo(key.lastUsedAt) : 'never'}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runTest(key.id)}
                          disabled={testingId === key.id}
                        >
                          {testingId === key.id ? <Loader2 className="animate-spin" /> : <Play />} Test
                        </Button>

                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={key.enabled ? 'Disable key' : 'Enable key'}
                          onClick={() =>
                            update.mutate(
                              { id: key.id, enabled: !key.enabled },
                              {
                                onSuccess: () => notify.success(key.enabled ? 'Key disabled.' : 'Key enabled.'),
                                onError: (error) => notify.error('Update failed', errorMessage(error)),
                              },
                            )
                          }
                        >
                          <Power className={key.enabled ? 'text-emerald-400' : 'text-muted-foreground'} />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Delete key">
                              <Trash2 className="text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Users relying on this shared key will fall back to their own key or to the next provider
                                in the chain. This is recorded in the audit log.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() =>
                                  remove.mutate(key.id, {
                                    onSuccess: () => notify.success('Key deleted.'),
                                    onError: (error) => notify.error('Delete failed', errorMessage(error)),
                                  })
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / bulk import */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setMode('single');
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'bulk' ? 'Bulk import keys' : 'Add a server key'}</DialogTitle>
            <DialogDescription>
              {mode === 'bulk'
                ? 'Paste one key per line. Blank lines and lines starting with # are ignored.'
                : 'This key is shared by every user who does not have their own key for the provider.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label required>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a provider…" />
                </SelectTrigger>
                <SelectContent>
                  {keyedProviders.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === 'bulk' ? (
              <div className="space-y-1.5">
                <Label required>Keys</Label>
                <Textarea
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                  placeholder={'sk-key-one\nsk-key-two\n# comment\nsk-key-three'}
                  className="min-h-32 font-mono text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label required>API key</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={keyValue}
                  onChange={(event) => setKeyValue(event.target.value)}
                  placeholder="sk-…"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label hint="optional">Label</Label>
                <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="ea-team" />
              </div>
              <div className="space-y-1.5">
                <Label hint="lower wins">Priority</Label>
                <Input
                  inputMode="numeric"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <div className="space-y-1.5">
                <Label hint="optional">Token quota</Label>
                <Input
                  inputMode="numeric"
                  value={quota}
                  onChange={(event) => setQuota(event.target.value.replace(/[^\d]/g, ''))}
                  placeholder="unlimited"
                />
              </div>
            </div>
          </div>

          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={add.isPending || bulkImport.isPending}>
              {mode === 'bulk' ? 'Import keys' : 'Save key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
