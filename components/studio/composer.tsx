'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Brain,
  Globe,
  ImagePlus,
  Loader2,
  Paperclip,
  Send,
  Shield,
  Square,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ModelPicker } from '@/components/studio/model-picker';
import { useChat } from '@/hooks/use-chat';
import { fileToDataUrl, errorMessage } from '@/lib/api/client';
import { composerPlaceholder, estimateTokens, guessMode, STARTER_PROMPTS } from '@/lib/utils/intent';
import { formatBytes } from '@/lib/utils/format';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import { notify } from '@/components/ui/toaster';
import { cn } from '@/lib/utils/cn';
import type { ChatMode } from '@/lib/router/classify';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  preview: string;
}

/**
 * Message composer.
 *
 * Features that matter in daily use: Enter sends / Shift+Enter newlines, image
 * attachments for vision models (downscaled client-side so providers accept
 * them), the thinking / web-search / hardening toggles, and a mode switch that
 * defaults to Auto so the classifier decides whether this is a chat or a build.
 */
export function Composer({
  mode,
  onModeChange,
  model,
  onModelChange,
  className,
  autoFocus,
  initialValue = '',
}: {
  mode: ChatMode | 'auto';
  onModeChange: (mode: ChatMode | 'auto') => void;
  model: string | null;
  onModelChange: (model: string | null) => void;
  className?: string;
  autoFocus?: boolean;
  initialValue?: string;
}) {
  const { send, stop, streaming } = useChat();
  const [text, setText] = React.useState(initialValue);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [webSearch, setWebSearch] = React.useState(false);
  const [deepHarden, setDeepHarden] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const effectiveMode: ChatMode = mode === 'auto' ? guessMode(text) : mode;
  const tokens = estimateTokens(text);

  // Grow the textarea with the content, up to ~8 lines.
  React.useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [text]);

  const addFiles = React.useCallback(async (files: FileList | File[]) => {
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!file.type.startsWith('image/')) {
        notify.error(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        notify.error(`${file.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        next.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          dataUrl,
          preview: dataUrl,
        });
      } catch (error) {
        notify.error(errorMessage(error));
      }
    }
    if (next.length > 0) setAttachments((current) => [...current, ...next].slice(0, 4));
  }, []);

  const submit = async () => {
    if (streaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const payloadText = trimmed || 'Describe this image.';
    const images = attachments.map((attachment) => attachment.dataUrl);

    setText('');
    setAttachments([]);

    await send(payloadText, {
      mode: effectiveMode,
      model: model ?? undefined,
      thinking: thinking || undefined,
      webSearch: webSearch || undefined,
      deepHarden: deepHarden || undefined,
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <div
      className={cn('relative', className)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
      }}
    >
      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-brand bg-brand/5 text-xs font-medium text-brand"
          >
            Drop images to attach
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="panel overflow-hidden shadow-sm">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-border p-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.preview}
                  alt={attachment.name}
                  className="size-14 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-card p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Textarea
          ref={textareaRef}
          value={text}
          autoFocus={autoFocus}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.some((file) => file.type.startsWith('image/'))) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          placeholder={composerPlaceholder(effectiveMode)}
          rows={1}
          className="min-h-[52px] resize-none border-0 bg-transparent px-3.5 py-3 shadow-none focus-visible:ring-0"
        />

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-2 py-1.5">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as ChatMode | 'auto')}
            aria-label="Mode"
          >
            <ToggleGroupItem value="auto" aria-label="Auto mode">
              <Wand2 /> Auto
            </ToggleGroupItem>
            <ToggleGroupItem value="chat" aria-label="Chat mode">
              Chat
            </ToggleGroupItem>
            <ToggleGroupItem value="build" aria-label="Build mode">
              Build
            </ToggleGroupItem>
          </ToggleGroup>

          <ModelPicker value={model} onChange={onModelChange} disabled={streaming} />

          <Hint label="Show the model's reasoning trace">
            <Button
              variant={thinking ? 'default' : 'ghost'}
              size="icon-sm"
              aria-pressed={thinking}
              onClick={() => setThinking((value) => !value)}
              aria-label="Toggle extended thinking"
            >
              <Brain />
            </Button>
          </Hint>

          <Hint label="Let the provider search the web">
            <Button
              variant={webSearch ? 'default' : 'ghost'}
              size="icon-sm"
              aria-pressed={webSearch}
              onClick={() => setWebSearch((value) => !value)}
              aria-label="Toggle web search"
            >
              <Globe />
            </Button>
          </Hint>

          <Hint label="Extra judge → fixer loops for higher quality">
            <Button
              variant={deepHarden ? 'default' : 'ghost'}
              size="icon-sm"
              aria-pressed={deepHarden}
              onClick={() => setDeepHarden((value) => !value)}
              aria-label="Toggle deep hardening"
            >
              <Shield />
            </Button>
          </Hint>

          <Hint label="Attach images for vision models">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach an image"
            >
              <ImagePlus />
            </Button>
          </Hint>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = '';
            }}
          />

          <div className="ml-auto flex items-center gap-2">
            {tokens > 200 ? (
              <Badge variant={tokens > 20_000 ? 'warning' : 'muted'} className="hidden sm:inline-flex">
                ~{tokens.toLocaleString()} tok
              </Badge>
            ) : null}
            {attachments.length > 0 ? (
              <Badge variant="info" className="hidden sm:inline-flex">
                <Paperclip /> {attachments.length}
              </Badge>
            ) : null}

            {streaming ? (
              <Button size="icon-sm" variant="outline" onClick={stop} aria-label="Stop generating">
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                onClick={() => void submit()}
                disabled={!text.trim() && attachments.length === 0}
                aria-label="Send"
              >
                {streaming ? <Loader2 className="animate-spin" /> : <ArrowUp />}
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>
          <span className="kbd">↵</span> send · <span className="kbd">⇧↵</span> newline · drop images to attach
        </span>
        <span className="capitalize">{effectiveMode === 'build' ? 'build pipeline' : effectiveMode} mode</span>
      </p>
    </div>
  );
}

/** Idle-state suggestions shown above the composer. */
export function StarterPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {STARTER_PROMPTS.map((starter) => (
        <button
          key={starter.label}
          type="button"
          onClick={() => onPick(starter.prompt)}
          className="panel panel-hover group flex items-start gap-2 p-3 text-left text-xs"
        >
          <Send className="mt-0.5 size-3.5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
          <span>
            <span className="block font-medium">{starter.label}</span>
            <span className="mt-0.5 line-clamp-2 block text-muted-foreground">{starter.prompt}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
