'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Save,
  Server,
  Settings2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { useAdminSystem } from '@/hooks/use-admin';
import { errorMessage } from '@/lib/api/client';
import { SYSTEM_DEFAULTS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils/format';

/**
 * System page: editable defaults, environment diagnostics and a JSON backup.
 *
 * The setting list is derived from `SYSTEM_DEFAULTS`, and the server rejects any
 * key that is not in it — an admin cannot invent a setting that nothing reads.
 */
export function SystemPanel() {
  const { settings, diagnostics, editableKeys, isLoading, save, backup } = useAdminSystem();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);

  React.useEffect(() => {
    if (Object.keys(settings).length === 0) return;
    const next: Record<string, string> = {};
    for (const key of editableKeys) {
      const value = settings[key];
      next[key] = value === null || value === undefined ? '' : String(value);
    }
    setDraft(next);
  }, [settings, editableKeys]);

  const dirty = React.useMemo(
    () => Object.entries(draft).some(([key, value]) => String(settings[key] ?? '') !== value),
    [draft, settings],
  );

  const submit = () => {
    const payload: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(draft)) {
      const original = settings[key];
      const numeric = typeof SYSTEM_DEFAULTS[key as keyof typeof SYSTEM_DEFAULTS] === 'number';
      const boolean = typeof SYSTEM_DEFAULTS[key as keyof typeof SYSTEM_DEFAULTS] === 'boolean';

      if (numeric) payload[key] = Number(value) || 0;
      else if (boolean) payload[key] = value === 'true';
      else payload[key] = value;

      if (String(original ?? '') === value) continue;
    }

    save.mutate(payload, {
      onSuccess: () => notify.success('Settings saved.', 'Applied to the next request.'),
      onError: (error) => notify.error('Could not save settings', errorMessage(error)),
    });
  };

  const runBackup = () => {
    backup.mutate(undefined, {
      onSuccess: (result) => {
        setCounts(result as Record<string, number>);
        notify.success('Backup downloaded.', 'Secrets are exported encrypted.');
      },
      onError: (error) => notify.error('Backup failed', errorMessage(error)),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Diagnostics */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Server className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Environment</h2>
          <Badge variant={diagnostics?.nodeEnv === 'production' ? 'success' : 'muted'} className="ml-auto">
            {diagnostics?.nodeEnv ?? 'unknown'}
          </Badge>
        </header>

        <dl className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Diagnostic ok={diagnostics?.databaseConfigured} label="Database URL" detail="POSTGRES_URL / DATABASE_URL" icon={<Database />} />
          <Diagnostic ok={diagnostics?.encryptionConfigured} label="Encryption key" detail="ENCRYPTION_KEY" icon={<KeyRound />} />
          <Diagnostic ok={diagnostics?.upstashConfigured} label="Distributed rate limiting" detail="Upstash Redis (optional)" icon={<HardDrive />} />
          <Diagnostic ok={diagnostics?.oauth.google} label="Google OAuth" detail="AUTH_GOOGLE_ID + SECRET" icon={<CheckCircle2 />} required={false} />
          <Diagnostic ok={diagnostics?.oauth.github} label="GitHub OAuth" detail="AUTH_GITHUB_ID + SECRET" icon={<CheckCircle2 />} required={false} />
          <Diagnostic ok={diagnostics?.ownerEmailConfigured} label="Owner bootstrap" detail="OWNER_EMAIL" icon={<CheckCircle2 />} required={false} />
        </dl>

        <Separator className="my-3" />
        <p className="text-[11px] text-muted-foreground">
          Node {diagnostics?.nodeVersion ?? '—'} · region {diagnostics?.regions ?? '—'} · app URL{' '}
          {diagnostics?.appUrl ?? 'not set'}
        </p>
      </section>

      {/* Settings */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Settings2 className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Defaults</h2>
          {dirty ? <Badge variant="warning">unsaved changes</Badge> : null}
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {editableKeys.map((key) => {
            const defaultValue = SYSTEM_DEFAULTS[key as keyof typeof SYSTEM_DEFAULTS];
            const isBoolean = typeof defaultValue === 'boolean';
            const value = draft[key] ?? '';

            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`setting-${key}`} className="font-mono text-[11px]">
                  {key}
                </Label>
                {isBoolean ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={value === 'true' ? 'default' : 'outline'}
                      onClick={() => setDraft((current) => ({ ...current, [key]: value === 'true' ? 'false' : 'true' }))}
                    >
                      {value === 'true' ? 'enabled' : 'disabled'}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">default: {String(defaultValue)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      id={`setting-${key}`}
                      inputMode={typeof defaultValue === 'number' ? 'numeric' : 'text'}
                      value={value}
                      onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                      className="h-8 text-xs"
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">default: {String(defaultValue)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={submit} loading={save.isPending} disabled={!dirty}>
            <Save /> Save defaults
          </Button>
          {dirty ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next: Record<string, string> = {};
                for (const key of editableKeys) next[key] = String(settings[key] ?? '');
                setDraft(next);
              }}
            >
              Discard
            </Button>
          ) : null}
        </div>
      </section>

      {/* Backup */}
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-3 flex items-center gap-2">
          <Download className="size-4 text-brand" />
          <h2 className="text-sm font-medium">Backup</h2>
        </header>
        <p className="text-[11px] text-muted-foreground">
          Exports users, chats, messages, projects, keys (still encrypted), generated images, usage, audit entries and
          settings as a single JSON file. Ciphertext written with a different ENCRYPTION_KEY will not decrypt after a
          restore, so rotate those keys afterwards.
        </p>

        {counts ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(counts).map(([table, count]) => (
              <Badge key={table} variant="muted">
                {table}: {formatNumber(count)}
              </Badge>
            ))}
          </div>
        ) : null}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="mt-3" loading={backup.isPending}>
              <Download /> Download backup
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Export the whole database?</AlertDialogTitle>
              <AlertDialogDescription>
                This includes every user, message, project and stored key (encrypted). The export is downloaded straight
                to your browser and the action is recorded in the audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runBackup}>Download</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            There is no automatic restore endpoint — by design. Restore by importing the JSON into a fresh database with
            your own script, so a compromised admin session cannot overwrite production data.
          </span>
        </div>
      </section>
    </div>
  );
}

function Diagnostic({
  ok,
  label,
  detail,
  icon,
  required = true,
}: {
  ok?: boolean;
  label: string;
  detail: string;
  icon: React.ReactNode;
  required?: boolean;
}) {
  const state = ok === undefined ? 'unknown' : ok ? 'ok' : required ? 'missing' : 'optional';

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 p-3">
      <span
        className={
          state === 'ok'
            ? 'text-emerald-400'
            : state === 'missing'
              ? 'text-destructive'
              : 'text-muted-foreground'
        }
      >
        {state === 'ok' ? (
          <CheckCircle2 className="size-4" />
        ) : state === 'missing' ? (
          <XCircle className="size-4" />
        ) : (
          <span className="[&_svg]:size-4">{icon}</span>
        )}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium">{label}</dt>
        <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</dd>
      </div>
    </div>
  );
}
