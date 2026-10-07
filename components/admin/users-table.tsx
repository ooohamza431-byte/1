'use client';

import * as React from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  Gauge,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage, initialsOf } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useAdminUsers } from '@/hooks/use-admin';
import { useMe } from '@/hooks/use-me';
import { errorMessage } from '@/lib/api/client';
import { formatCost, formatNumber, formatTokens, timeAgo } from '@/lib/utils/format';

/**
 * User administration: promote, ban, set quotas, reset rate limits, inspect a
 * user's conversations read-only, or delete an account outright.
 *
 * Guardrails are enforced server-side (you cannot act on yourself, the owner is
 * immutable, only an owner may change roles or delete) — the UI mirrors those
 * rules so the buttons that would fail are simply disabled.
 */
export function UsersTable() {
  const me = useMe();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [role, setRole] = React.useState('all');
  const [banned, setBanned] = React.useState('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { users, summary, isLoading, detail, update, remove } = useAdminUsers({
    search: debounced || undefined,
    role,
    banned,
  });

  const userDetail = detail(selectedId);
  const isSelf = (id: string) => me.me?.id === id;
  const canManage = me.can('users.write');
  const canDelete = me.can('users.delete');

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={String(summary?.total ?? users.length)} icon={<Users />} tone="admin" />
        <StatCard label="Admins" value={String(summary?.admins ?? 0)} icon={<ShieldCheck />} tone="brand" />
        <StatCard label="Active today" value={String(summary?.activeToday ?? 0)} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Banned" value={String(summary?.banned ?? 0)} icon={<Ban />} tone={(summary?.banned ?? 0) > 0 ? 'danger' : 'default'} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or name…"
            className="pl-9"
          />
        </div>

        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
          </SelectContent>
        </Select>

        <Select value={banned} onValueChange={setBanned}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="false">Active</SelectItem>
            <SelectItem value="true">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={<Users />} title="No users match those filters" description="Try clearing the search or the role filter." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <Avatar className="size-7">
                        <AvatarImage src={user.image ?? undefined} alt={user.name ?? user.email} />
                        <AvatarFallback>{initialsOf(user.name, user.email)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{user.name ?? '—'}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
                      </span>
                      {user.banned ? <Badge variant="danger">banned</Badge> : null}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant={user.role === 'owner' ? 'default' : user.role === 'admin' ? 'admin' : 'muted'}>
                      {user.role}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-[11px] text-muted-foreground">
                    <span className="block">{timeAgo(user.lastActiveAt)}</span>
                    <span className="block">{user.chatCount} chats</span>
                  </TableCell>

                  <TableCell className="text-xs">
                    <span className="block font-mono">{formatTokens(user.totalTokens)} tok</span>
                    <span className="block text-[11px] text-muted-foreground">{user.totalRequests} requests</span>
                  </TableCell>

                  <TableCell className="font-mono text-xs">{formatCost(user.totalCost)}</TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(user.id)}>
                        <Eye /> Inspect
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${user.email}`}>
                            <UserCog />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Administration</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem disabled={!canManage || isSelf(user.id)} onClick={() => {
                            if (!canManage) return;
                            update.mutate(
                              { id: user.id, resetRateLimit: true },
                              {
                                onSuccess: () => notify.success('Rate limit reset.'),
                                onError: (error) => notify.error('Failed', errorMessage(error)),
                              },
                            );
                          }}>
                            <RotateCcw /> Reset rate limit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={!canManage || isSelf(user.id)}
                            onClick={() => setSelectedId(user.id)}
                          >
                            <Gauge /> Adjust quotas
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            disabled={!canDelete || isSelf(user.id) || user.role === 'owner'}
                            onClick={() =>
                              update.mutate(
                                { id: user.id, role: user.role === 'admin' ? 'user' : 'admin' },
                                {
                                  onSuccess: () => notify.success(`Role set to ${user.role === 'admin' ? 'user' : 'admin'}.`),
                                  onError: (error) => notify.error('Role change failed', errorMessage(error)),
                                },
                              )
                            }
                          >
                            <ShieldCheck /> {user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            disabled={!canManage || isSelf(user.id) || user.role === 'owner'}
                            destructive={!user.banned}
                            onClick={() =>
                              update.mutate(
                                {
                                  id: user.id,
                                  banned: !user.banned,
                                  banReason: user.banned ? null : 'Banned from the admin panel',
                                },
                                {
                                  onSuccess: () => notify.success(user.banned ? 'User unbanned.' : 'User banned.'),
                                  onError: (error) => notify.error('Failed', errorMessage(error)),
                                },
                              )
                            }
                          >
                            <Ban /> {user.banned ? 'Unban user' : 'Ban user'}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                disabled={!canDelete || isSelf(user.id) || user.role === 'owner'}
                                destructive
                                onSelect={(event) => event.preventDefault()}
                              >
                                <Trash2 /> Delete account
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {user.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the account and cascades to their chats, messages, projects,
                                  keys, images and usage history. Export anything you need first.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() =>
                                    remove.mutate(user.id, {
                                      onSuccess: () => notify.success('Account deleted.'),
                                      onError: (error) => notify.error('Delete failed', errorMessage(error)),
                                    })
                                  }
                                >
                                  Delete permanently
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Inspector */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>User detail</DialogTitle>
            <DialogDescription>
              Read-only impersonation: you can see their conversations, but never act as them. Opening this view is
              recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          {userDetail.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : userDetail.isError ? (
            <p className="text-xs text-destructive">{errorMessage(userDetail.error)}</p>
          ) : userDetail.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={userDetail.data.user.image ?? undefined} alt={userDetail.data.user.email} />
                  <AvatarFallback>{initialsOf(userDetail.data.user.name, userDetail.data.user.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{userDetail.data.user.name ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {userDetail.data.user.email} · {userDetail.data.user.role} · joined{' '}
                    {timeAgo(userDetail.data.user.createdAt)}
                  </p>
                </div>
              </div>

              <QuotaEditor
                userId={userDetail.data.user.id}
                quotas={userDetail.data.user.quotas}
                disabled={!canManage || isSelf(userDetail.data.user.id)}
                onSave={(quotas, done) =>
                  update.mutate(
                    { id: userDetail.data!.user.id, ...quotas },
                    {
                      onSuccess: () => {
                        notify.success('Quotas updated.');
                        done();
                      },
                      onError: (error) => {
                        notify.error('Could not save quotas', errorMessage(error));
                        done();
                      },
                    },
                  )
                }
              />

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium">Conversations ({userDetail.data.chats.length})</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin">
                    {userDetail.data.chats.map((chat) => (
                      <li key={chat.id} className="rounded-md border border-border px-2.5 py-1.5 text-[11px]">
                        <span className="block truncate font-medium">{chat.title || 'Untitled'}</span>
                        <span className="block text-muted-foreground">
                          {chat.mode ?? 'chat'} · {timeAgo(chat.updatedAt)}
                        </span>
                      </li>
                    ))}
                    {userDetail.data.chats.length === 0 ? (
                      <li className="text-[11px] text-muted-foreground">No conversations.</li>
                    ) : null}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium">Keys ({userDetail.data.keys.length})</p>
                  <ul className="space-y-1">
                    {userDetail.data.keys.map((key) => (
                      <li
                        key={key.id}
                        className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="font-mono">{key.provider}</span>
                        <span className="font-mono text-muted-foreground">{key.hint}</span>
                        <Badge variant={key.status === 'active' ? 'success' : key.status === 'invalid' ? 'danger' : 'muted'}>
                          {key.status}
                        </Badge>
                      </li>
                    ))}
                    {userDetail.data.keys.length === 0 ? (
                      <li className="text-[11px] text-muted-foreground">No personal keys — using shared keys.</li>
                    ) : null}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {formatNumber(userDetail.data.imageCount)} generated images.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuotaEditor({
  quotas,
  disabled,
  onSave,
}: {
  userId: string;
  quotas: { maxTokensPerDay: number | null; maxBuildsPerDay: number | null; maxImagesPerDay: number | null };
  disabled?: boolean;
  onSave: (
    quotas: { maxTokensPerDay: number | null; maxBuildsPerDay: number | null; maxImagesPerDay: number | null },
    done: () => void,
  ) => void;
}) {
  const [tokens, setTokens] = React.useState(quotas.maxTokensPerDay?.toString() ?? '');
  const [builds, setBuilds] = React.useState(quotas.maxBuildsPerDay?.toString() ?? '');
  const [images, setImages] = React.useState(quotas.maxImagesPerDay?.toString() ?? '');
  const [saving, setSaving] = React.useState(false);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium">Per-user quota overrides</p>
      <p className="text-[11px] text-muted-foreground">
        Leave blank to inherit the system defaults. A value of 0 blocks that capability entirely.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Tokens / day</Label>
          <Input
            inputMode="numeric"
            value={tokens}
            disabled={disabled}
            onChange={(event) => setTokens(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="inherit"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Builds / day</Label>
          <Input
            inputMode="numeric"
            value={builds}
            disabled={disabled}
            onChange={(event) => setBuilds(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="inherit"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Images / day</Label>
          <Input
            inputMode="numeric"
            value={images}
            disabled={disabled}
            onChange={(event) => setImages(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="inherit"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || saving}
        loading={saving}
        onClick={() => {
          setSaving(true);
          onSave(
            {
              maxTokensPerDay: tokens ? Number(tokens) : null,
              maxBuildsPerDay: builds ? Number(builds) : null,
              maxImagesPerDay: images ? Number(images) : null,
            },
            () => setSaving(false),
          );
        }}
      >
        Save quotas
      </Button>
      {disabled ? (
        <p className="text-[11px] text-muted-foreground">
          You cannot edit your own quotas — ask another admin or the owner.
        </p>
      ) : null}
    </div>
  );
}
