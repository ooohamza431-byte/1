'use client';

import * as React from 'react';
import { Check, Flag, MessageSquareWarning, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { useAdminModeration } from '@/hooks/use-admin';
import { errorMessage } from '@/lib/api/client';
import { timeAgo } from '@/lib/utils/format';

/**
 * Moderation.
 *
 * Two mechanisms, deliberately different: a pre-flight blocklist (literal text
 * or a regular expression) that stops a prompt before it costs anything, and a
 * post-hoc flag on individual messages for review. The pattern list is cached in
 * memory for 30 seconds and invalidated on write, so a change applies instantly
 * without hammering the database on every message.
 */
export function ModerationView() {
  const [view, setView] = React.useState<'chats' | 'patterns'>('chats');
  const [flaggedOnly, setFlaggedOnly] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [pattern, setPattern] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isLiteral, setIsLiteral] = React.useState(false);

  const moderation = useAdminModeration(view === 'patterns' ? 'patterns' : 'chats', {
    flagged: flaggedOnly,
    search: search.trim() || undefined,
  });

  return (
    <div className="space-y-5">
      <Tabs value={view} onValueChange={(value) => setView(value as 'chats' | 'patterns')}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="chats">
              <MessageSquareWarning /> Messages
            </TabsTrigger>
            <TabsTrigger value="patterns">
              <ShieldAlert /> Blocked patterns
            </TabsTrigger>
          </TabsList>

          {view === 'chats' ? (
            <>
              <div className="flex items-center gap-2">
                <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} aria-label="Flagged only" />
                <Label className="text-xs">Flagged only</Label>
              </div>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search message content…"
                className="max-w-64"
              />
            </>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => moderation.exportCsv()}
          >
            Export CSV
          </Button>
        </div>

        {/* Messages */}
        <TabsContent value="chats" className="space-y-3">
          {moderation.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : moderation.messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquareWarning />}
              title={flaggedOnly ? 'Nothing is flagged' : 'No messages to review'}
              description={
                flaggedOnly
                  ? 'Flagged messages appear here for review. Flagging does not delete anything — it marks a message so it can be found later.'
                  : 'Every user message and model reply is listed here with its provider, cost and timestamp.'
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moderation.messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="max-w-md">
                        <span className="flex items-center gap-2">
                          <Badge variant={message.role === 'user' ? 'secondary' : 'muted'}>{message.role}</Badge>
                          {message.flagged ? <Badge variant="warning">flagged</Badge> : null}
                        </span>
                        <span className="mt-1 block line-clamp-3 text-[11px] text-muted-foreground">
                          {message.content.slice(0, 400)}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <span className="block">{message.userEmail}</span>
                        <span className="block truncate text-muted-foreground">{message.chatTitle}</span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{message.agent ?? '—'}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{timeAgo(message.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={message.flagged ? 'outline' : 'ghost'}
                            disabled={message.flagged}
                            onClick={() =>
                              moderation.flag.mutate(
                                { messageId: message.id, reason: 'Flagged from the admin panel' },
                                {
                                  onSuccess: () => notify.success('Message flagged for review.'),
                                  onError: (error) => notify.error('Could not flag', errorMessage(error)),
                                },
                              )
                            }
                          >
                            <Flag /> {message.flagged ? 'Flagged' : 'Flag'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Patterns */}
        <TabsContent value="patterns" className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Plus className="size-3.5 text-brand" />
              Block a pattern
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label required hint={isLiteral ? 'plain text match' : 'regular expression'}>
                  Pattern
                </Label>
                <Textarea
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  placeholder={isLiteral ? 'credit card number' : '\\b\\d{16}\\b|ssh-rsa AAAA'}
                  className="min-h-20 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label hint="shown in the blocklist">Reason</Label>
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Blocks attempts to exfiltrate credentials"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isLiteral} onCheckedChange={setIsLiteral} aria-label="Literal match" />
                  <Label className="text-xs">Literal match (not a regular expression)</Label>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              className="mt-3"
              loading={moderation.addPattern.isPending}
              disabled={pattern.trim().length === 0}
              onClick={() =>
                moderation.addPattern.mutate(
                  { pattern: pattern.trim(), reason: reason.trim() || undefined, isLiteral },
                  {
                    onSuccess: () => {
                      notify.success('Pattern blocked.', 'Prompts matching it are rejected before any provider call.');
                      setPattern('');
                      setReason('');
                    },
                    onError: (error) => notify.error('Could not add the pattern', errorMessage(error)),
                  },
                )
              }
            >
              <ShieldAlert /> Block pattern
            </Button>
          </section>

          {moderation.patterns.length === 0 ? (
            <EmptyState
              compact
              icon={<ShieldAlert />}
              title="No blocked patterns"
              description="Patterns are checked before a request leaves the server, so a blocked prompt never reaches a provider and never costs anything."
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {moderation.patterns.map((row) => (
                <li key={row.id} className="flex items-center gap-3 bg-card px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{row.pattern}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.isLiteral ? 'literal' : 'regex'} · {row.reason ?? 'no reason given'} · added{' '}
                      {timeAgo(row.createdAt)}
                    </p>
                  </div>
                  <Badge variant="muted">{row.matches} hits</Badge>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove pattern"
                    onClick={() =>
                      moderation.removePattern.mutate(row.id, {
                        onSuccess: () => notify.success('Pattern removed.'),
                        onError: (error) => notify.error('Could not remove', errorMessage(error)),
                      })
                    }
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
            Invalid regular expressions are rejected when you save them, so a typo cannot silently disable moderation.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
