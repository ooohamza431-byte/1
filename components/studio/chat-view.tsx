'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Gauge, KeyRound, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopBar } from '@/components/studio/top-bar';
import { Composer } from '@/components/studio/composer';
import { MessageList } from '@/components/studio/message-list';
import { PipelineBar } from '@/components/studio/pipeline-bar';
import { ThinkingPanel } from '@/components/studio/thinking-panel';
import { ProjectCard } from '@/components/studio/project-card';
import { PreviewPane } from '@/components/studio/preview-pane';
import { useChat } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { useProviders } from '@/hooks/use-providers';
import { useUiStore } from '@/stores/ui';
import { formatCost, formatTokens } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ChatMode } from '@/lib/router/classify';

/**
 * The studio workspace: transcript on the left, live preview on the right.
 *
 * Every piece of live state (agent steps, thinking trace, partial files,
 * routing chain, logs) comes from the single SSE-driven chat store, so the
 * panes never disagree with each other.
 */
export function ChatView({ chatId }: { chatId?: string }) {
  const chat = useChat();
  const { quotas, totals } = useMe();
  const { summary } = useProviders();
  const previewOpen = useUiStore((state) => state.previewOpen);
  const setPreviewOpen = useUiStore((state) => state.setPreviewOpen);
  const togglePreview = useUiStore((state) => state.togglePreview);

  const [mode, setMode] = React.useState<ChatMode | 'auto'>('auto');
  const [model, setModel] = React.useState<string | null>(null);
  const [dismissedWarning, setDismissedWarning] = React.useState(false);

  // The composer is reused by the empty state, so a picked starter is pushed
  // straight through the same send path.
  const handleStarter = (prompt: string) => {
    void chat.send(prompt, { mode: mode === 'auto' ? undefined : mode, model: model ?? undefined });
  };

  const hasProject = Boolean(chat.project && chat.project.files.length > 0);
  const noKeys = summary !== null && summary.usable === 0;

  // Auto-open the preview the first time a build produces files.
  React.useEffect(() => {
    if (hasProject) setPreviewOpen(true);
  }, [hasProject, setPreviewOpen]);

  return (
    /*
      `h-full` + `min-h-0` keeps the transcript and the preview pane inside the
      viewport: they scroll themselves, and <main> never grows past one screen.
      Without this the preview iframe resolved `height: 100%` against a column
      that grew with the content, so it rendered thousands of pixels tall and the
      generated app sat far below the fold — which looks like a blank preview.
    */
    <div className="flex h-full min-h-0 flex-col">
      <TopBar
        title={chat.intent?.mode === 'build' ? 'Build studio' : 'Chat studio'}
        subtitle={chat.chainSummary || undefined}
        previewToggle
        activeChatId={chatId}
        onNewChat={() => chat.reset()}
      />

      {noKeys && !dismissedWarning ? (
        <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">
            No provider keys are available yet. An admin can add a server key in{' '}
            <a href="/admin/keys" className="underline">
              Admin → Keys
            </a>{' '}
            so every user can build with zero setup, or you can add your own in{' '}
            <a href="/studio/keys" className="underline">
              API keys
            </a>
            . Image generation already works without any key.
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => setDismissedWarning(true)} aria-label="Dismiss">
            <X />
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {chat.steps.length > 0 && !previewOpen ? (
            <div className="px-4 pt-3 sm:px-6">
              <PipelineBar steps={chat.steps} score={chat.project?.score ?? null} rounds={chat.project?.rounds} />
            </div>
          ) : null}

          <MessageList
            messages={chat.messages}
            streaming={chat.streaming}
            onPickStarter={handleStarter}
            onOpenProject={() => setPreviewOpen(true)}
            onRetry={() => {
              const lastUser = [...chat.messages].reverse().find((message) => message.role === 'user');
              if (lastUser) void chat.send(lastUser.content, { mode: mode === 'auto' ? undefined : mode, model: model ?? undefined });
            }}
          />

          <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-4 sm:px-6">
            {chat.thinkingText.trim().length > 0 ? (
              <ThinkingPanel thinking={chat.thinkingByAgent} streaming={chat.streaming} />
            ) : null}

            {hasProject && chat.project ? (
              <ProjectCard project={chat.project} onOpenPreview={() => setPreviewOpen(true)} />
            ) : null}

            <Composer
              mode={mode}
              onModeChange={setMode}
              model={model}
              onModelChange={setModel}
              autoFocus
            />

            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-2">
                {chat.providersUsed.length > 0 ? (
                  <>
                    <Sparkles className="size-3" />
                    served by {chat.providersUsed.join(', ')}
                  </>
                ) : chat.chain.length > 0 ? (
                  <>
                    <Gauge className="size-3" />
                    chain: {chat.chain.slice(0, 4).map((entry) => entry.providerName).join(' → ')}
                    {chat.chain.length > 4 ? ' …' : ''}
                  </>
                ) : null}
              </span>

              <span className="flex items-center gap-2">
                {chat.usage ? (
                  <Badge variant="muted">
                    this run {formatTokens(chat.usage.tokens)} tok · {formatCost(chat.usage.cost)}
                  </Badge>
                ) : null}
                {quotas ? (
                  <Badge variant={quotas.tokens.percent > 90 ? 'warning' : 'muted'}>
                    today {formatTokens(quotas.tokens.used)}
                  </Badge>
                ) : null}
                {totals ? (
                  <span className="hidden items-center gap-1 sm:flex">
                    <KeyRound className="size-3" />
                    {chat.chain.filter((entry) => entry.keySource === 'user').length} your key
                    {chat.chain.filter((entry) => entry.keySource === 'server').length > 0
                      ? ` · ${chat.chain.filter((entry) => entry.keySource === 'server').length} server`
                      : ''}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        </div>

        {/* Preview rail */}
        <AnimatePresence initial={false}>
          {previewOpen ? (
            <motion.aside
              key="preview"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '46%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className={cn('hidden min-w-0 shrink-0 border-l border-border lg:block')}
            >
              <PreviewPane project={chat.project} onClose={() => setPreviewOpen(false)} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile: the preview becomes a slide-up sheet */}
      <AnimatePresence>
        {previewOpen && hasProject ? (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-x-0 bottom-14 top-14 z-40 border-t border-border bg-background lg:hidden"
          >
            <PreviewPane project={chat.project} onClose={togglePreview} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
