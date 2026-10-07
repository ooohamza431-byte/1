'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bug,
  ClipboardList,
  Code2,
  FileSearch,
  Gavel,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/studio/top-bar';
import { Composer } from '@/components/studio/composer';
import { MessageList } from '@/components/studio/message-list';
import { PipelineBar } from '@/components/studio/pipeline-bar';
import { ThinkingPanel } from '@/components/studio/thinking-panel';
import { ProjectCard } from '@/components/studio/project-card';
import { PreviewPane } from '@/components/studio/preview-pane';
import { useChat } from '@/hooks/use-chat';
import { AGENT_LABELS, AGENT_ROLE_HINTS, BUILD_AGENT_IDS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

const AGENT_ICONS = {
  planner: ClipboardList,
  coder: Code2,
  reviewer: FileSearch,
  fixer: Wrench,
  enhancer: Sparkles,
  judge: Gavel,
  hardener: ShieldCheck,
  chat: Bug,
} as const;

/**
 * Build studio.
 *
 * Same engine as the chat studio, but pre-committed to build mode and framed
 * around the pipeline: the agent roster is visible before you send anything, so
 * it is obvious what is about to happen and what each step contributes.
 */
export function BuildView() {
  const chat = useChat();
  const [model, setModel] = React.useState<string | null>(null);

  const starters = [
    'Build a kanban board with drag-and-drop, localStorage and dark mode.',
    'Build a personal finance dashboard with a CSV import and inline SVG charts.',
    'Build a markdown notes app with search, tags and export to PDF.',
    'Build a landing page for a coffee subscription with a pricing table.',
  ];

  return (
    <>
      <PageHeader
        icon={<Wand2 />}
        title="Build studio"
        description="Multi-file projects, produced by a plan → code → review → fix → enhance → score pipeline."
        actions={
          <>
            <Badge variant="default">{chat.intent?.agents.length ?? BUILD_AGENT_IDS.length} agents</Badge>
            {chat.project?.score !== null && chat.project?.score !== undefined ? (
              <Badge variant={chat.project.score >= 9 ? 'success' : 'warning'}>judge {chat.project.score}/10</Badge>
            ) : null}
          </>
        }
        className="border-b border-border px-4 py-4 sm:px-6"
      />

      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-h-0 flex-col border-border lg:border-r">
          {chat.steps.length > 0 ? (
            <div className="px-4 pt-4 sm:px-6">
              <PipelineBar steps={chat.steps} score={chat.project?.score ?? null} rounds={chat.project?.rounds} />
            </div>
          ) : null}

          <MessageList
            messages={chat.messages}
            streaming={chat.streaming}
            onPickStarter={(prompt) => void chat.send(prompt, { mode: 'build' })}
          />

          <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4 sm:px-6">
            {chat.thinkingText.trim().length > 0 ? (
              <ThinkingPanel thinking={chat.thinkingByAgent} streaming={chat.streaming} />
            ) : null}

            {chat.project && chat.project.files.length > 0 ? <ProjectCard project={chat.project} /> : null}

            <Composer mode="build" onModeChange={() => undefined} model={model} onModelChange={setModel} autoFocus />
          </div>
        </div>

        {/* Agent roster + rolling preview */}
        <aside className="hidden min-w-0 flex-col border-l border-border bg-card/30 lg:flex">
          <div className="border-b border-border p-4">
            <h2 className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="size-3.5 text-brand" />
              Pipeline
            </h2>
            <ol className="mt-3 space-y-2.5">
              {BUILD_AGENT_IDS.map((agent, index) => {
                const step = chat.steps.find((item) => item.agent === agent);
                const Icon = AGENT_ICONS[agent] ?? Sparkles;
                return (
                  <li key={agent} className="flex gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                        step?.status === 'running'
                          ? 'border-brand bg-brand/15 text-brand'
                          : step?.status === 'done'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                            : step?.status === 'failed'
                              ? 'border-destructive/50 bg-destructive/10 text-destructive'
                              : 'border-border text-muted-foreground',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {AGENT_LABELS[agent]}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {AGENT_ROLE_HINTS[agent]}
                      </span>
                      {step?.provider ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                          {step.provider}
                          {step.model ? ` · ${step.model.replace(/^.*\//, '')}` : ''}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <Separator />

          <div className="min-h-0 flex-1">
            <PreviewPane project={chat.project} />
          </div>

          <div className="border-t border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              Prompt ideas:{' '}
              {starters.length} hand-written starters are available in the transcript — or describe your own app in one
              or two sentences.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile preview */}
      <AnimatePresence>
        {chat.project && chat.project.files.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-border lg:hidden"
          >
            <Button
              variant="ghost"
              className="w-full rounded-none"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([chat.project?.preview ?? ''], { type: 'text/html' }));
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              Open preview in a new tab
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
