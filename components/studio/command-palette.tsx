'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  History,
  Image as ImageIcon,
  KeyRound,
  MessageSquarePlus,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Wand2,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useHistory } from '@/hooks/use-history';
import { useMe } from '@/hooks/use-me';
import { useUiStore } from '@/stores/ui';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

/**
 * Command palette (⌘K). Navigates, starts a new chat, toggles the theme and
 * jumps straight into any recent conversation — the fastest path back to work
 * after a context switch.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onNewChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const { chats } = useHistory({ limit: 20, enabled: open });
  const { isAdmin } = useMe();
  const setTheme = useUiStore((state) => state.setTheme);
  const resolvedTheme = useUiStore((state) => state.resolvedTheme);
  const togglePreview = useUiStore((state) => state.togglePreview);
  const resetChat = useChatStore((state) => state.reset);

  const commands = React.useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: 'new-chat',
        label: 'New chat',
        hint: 'Start a fresh conversation',
        icon: MessageSquarePlus,
        keywords: 'new reset clear',
        run: () => {
          resetChat();
          onNewChat();
          router.push('/studio');
        },
      },
      {
        id: 'build',
        label: 'Build mode',
        hint: 'Six-agent pipeline',
        icon: Wand2,
        keywords: 'agents pipeline project',
        run: () => router.push('/studio/build'),
      },
      {
        id: 'images',
        label: 'Image studio',
        hint: 'Pollinations, no key needed',
        icon: ImageIcon,
        keywords: 'image generate picture pollinations',
        run: () => router.push('/studio/images'),
      },
      {
        id: 'history',
        label: 'History',
        icon: History,
        keywords: 'chats past conversations',
        run: () => router.push('/studio/history'),
      },
      {
        id: 'keys',
        label: 'API keys',
        hint: 'Bring your own provider keys',
        icon: KeyRound,
        keywords: 'byok provider credentials',
        run: () => router.push('/studio/keys'),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        keywords: 'profile preferences theme',
        run: () => router.push('/studio/settings'),
      },
      {
        id: 'theme',
        label: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`,
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        keywords: 'theme appearance dark light',
        run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'preview',
        label: 'Toggle preview pane',
        icon: Zap,
        keywords: 'panel iframe preview split',
        run: togglePreview,
      },
    ];

    if (isAdmin) {
      base.push({
        id: 'admin',
        label: 'Admin panel',
        hint: 'Keys, users, features, analytics',
        icon: Shield,
        keywords: 'admin console manage',
        run: () => router.push('/admin'),
      });
    }

    for (const chat of chats) {
      base.push({
        id: `chat-${chat.id}`,
        label: chat.title || 'Untitled chat',
        hint: `${timeAgo(chat.updatedAt)} · ${chat.messageCount} messages`,
        icon: Search,
        keywords: 'chat conversation resume',
        run: () => router.push(`/studio/${chat.id}`),
      });
    }

    return base;
  }, [chats, isAdmin, onNewChat, resetChat, resolvedTheme, router, setTheme, togglePreview]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands.slice(0, 12);
    return commands
      .filter((command) =>
        `${command.label} ${command.keywords ?? ''} ${command.hint ?? ''}`.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [commands, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) {
        command.run();
        onOpenChange(false);
        setQuery('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="gap-0 overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, chats and pages…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <span className="kbd">esc</span>
        </div>

        <ul className="max-h-[22rem] overflow-y-auto scrollbar-thin p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-muted-foreground">No matches.</li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    command.run();
                    onOpenChange(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    index === activeIndex ? 'bg-accent/60' : 'hover:bg-accent/30',
                  )}
                >
                  <command.icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{command.label}</span>
                    {command.hint ? (
                      <span className="block truncate text-[11px] text-muted-foreground">{command.hint}</span>
                    ) : null}
                  </span>
                  {index === activeIndex ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            navigate
            <span className="kbd">↵</span>
            run
          </span>
          <Badge variant="muted">{filtered.length} results</Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
