'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Download,
  FileCode2,
  MessageSquare,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
import { useHistory } from '@/hooks/use-history';
import { errorMessage } from '@/lib/api/client';
import { formatCost, formatTokens, timeAgo, truncate } from '@/lib/utils/format';
import { downloadText, transcriptToMarkdown } from '@/lib/utils/exporters';

/**
 * Conversation history with live search across message bodies (the POST search
 * endpoint runs a full-text match server-side, so it finds things the list
 * titles would never reveal).
 */
export function HistoryList() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const { chats, isLoading, remove, searchMessages } = useHistory({ search: debounced || undefined });

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = searchMessages.data?.results ?? [];
  const searching = debounced.length >= 2;

  const exportMarkdown = (chatId: string, title: string) => {
    void (async () => {
      try {
        const response = await fetch(`/api/history/${chatId}`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Request failed (${response.status}).`);
        const detail = (await response.json()) as {
          chat: { title: string };
          messages: Array<{ role: string; content: string; agent?: string | null; createdAt?: string }>;
        };
        downloadText(
          transcriptToMarkdown(detail.messages, detail.chat.title || title),
          `${(detail.chat.title || title).replace(/[^\w]+/g, '-').slice(0, 40)}.md`,
        );
        notify.success('Transcript exported.');
      } catch (error) {
        notify.error('Export failed', errorMessage(error));
      }
    })();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations and message content…"
          className="pl-9 pr-9"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {searching && results.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message matches · {results.length}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {results.map((result, index) => (
              <li key={`${result.chatId}-${index}`}>
                <Link
                  href={`/studio/${result.chatId}`}
                  className="block px-3.5 py-2.5 transition-colors hover:bg-accent/30"
                >
                  <p className="flex items-center gap-2 text-xs font-medium">
                    {truncate(result.chatTitle, 48)}
                    <Badge variant={result.role === 'user' ? 'secondary' : 'muted'}>{result.role}</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(result.createdAt)}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{result.snippet}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : chats.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title={debounced ? 'No conversations match that search' : 'No conversations yet'}
          description={
            debounced
              ? 'Try a shorter query, or clear the search to see everything.'
              : 'Start a chat and it will show up here with its token and cost totals.'
          }
          action={
            <Button asChild size="sm">
              <Link href="/studio">Go to the studio</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {chats.map((chat) => (
            <li key={chat.id} className="group flex items-center gap-3 bg-card px-3.5 py-3">
              <button
                type="button"
                onClick={() => router.push(`/studio/${chat.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{chat.title || 'Untitled chat'}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{timeAgo(chat.updatedAt)}</span>
                  <span>·</span>
                  <span>{chat.messageCount} messages</span>
                  {chat.projectCount > 0 ? (
                    <>
                      <span>·</span>
                      <Badge variant="default">
                        <FileCode2 /> {chat.projectCount} project{chat.projectCount === 1 ? '' : 's'}
                      </Badge>
                    </>
                  ) : null}
                  {chat.totalTokens ? (
                    <>
                      <span>·</span>
                      <span className="font-mono">{formatTokens(chat.totalTokens)} tok</span>
                    </>
                  ) : null}
                  {chat.totalCost ? (
                    <>
                      <span>·</span>
                      <span className="font-mono">{formatCost(chat.totalCost)}</span>
                    </>
                  ) : null}
                </p>
              </button>

              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => exportMarkdown(chat.id, chat.title)}
                  aria-label="Export transcript as markdown"
                >
                  <Download />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${chat.title}`}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{truncate(chat.title, 40)}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the conversation, its messages and any generated projects. It cannot be undone —
                        export the transcript first if you want to keep it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() =>
                          remove.mutate(chat.id, {
                            onSuccess: () => notify.success('Conversation deleted.'),
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
