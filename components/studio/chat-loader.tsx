'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { ChatView } from '@/components/studio/chat-view';
import { useHistory } from '@/hooks/use-history';
import { useChatStore, type ChatMessageView } from '@/stores/chat';
import { errorMessage } from '@/lib/api/client';
import { buildPreviewDocument } from '@/lib/agents/parser';

/**
 * Loads a saved conversation into the chat store, then hands over to ChatView.
 *
 * The stored project's preview document is rebuilt here rather than persisted:
 * `buildPreviewDocument` inlines CSS/JS, and storing that would double the size
 * of every project row for no benefit.
 */
export function ChatLoader({ chatId }: { chatId: string }) {
  const router = useRouter();
  const history = useHistory({ enabled: false });
  const detail = history.detail(chatId);
  const loadChat = useChatStore((state) => state.loadChat);

  React.useEffect(() => {
    if (!detail.data) return;

    const messages: ChatMessageView[] = detail.data.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      thinking: message.thinking ?? null,
      agent: message.agent ?? null,
      provider: message.provider ?? null,
      model: message.model ?? null,
      tokens: message.tokens,
      cost: message.cost,
      createdAt:
        typeof message.createdAt === 'string' ? message.createdAt : new Date(message.createdAt).toISOString(),
      projectId: null,
    }));

    const project = detail.data.project
      ? {
          files: detail.data.project.files,
          score: detail.data.project.score,
          rounds: detail.data.project.rounds,
          entryFile: detail.data.project.entryFile,
          preview: buildPreviewDocument(detail.data.project.files, detail.data.project.entryFile),
          projectId: detail.data.project.id,
          partial: false,
        }
      : null;

    loadChat({ chatId, messages, project });
  }, [detail.data, chatId, loadChat]);

  if (detail.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="Could not open that conversation"
          message={errorMessage(detail.error)}
          action={
            <Button size="sm" variant="outline" onClick={() => router.push('/studio')}>
              Back to the studio
            </Button>
          }
        />
      </div>
    );
  }

  if (detail.isLoading) {
    return (
      <>
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="ml-auto h-16 w-2/3" />
          <Skeleton className="h-28 w-full" />
        </div>
      </>
    );
  }

  return <ChatView chatId={chatId} />;
}
