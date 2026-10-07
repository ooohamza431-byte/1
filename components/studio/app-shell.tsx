'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/studio/sidebar';
import { CommandPalette } from '@/components/studio/command-palette';
import { useChatStore } from '@/stores/chat';
import { useUiStore } from '@/stores/ui';
import { useMe } from '@/hooks/use-me';
import { cn } from '@/lib/utils/cn';

/**
 * Two-pane application shell.
 *
 * Desktop: a fixed 288px sidebar plus the routed content.
 * Mobile: the sidebar collapses into the Sheet owned by MobileNav, and a
 * bottom bar (40px of content padding keeps it clear) handles quick switching.
 *
 * The shell is exactly one viewport tall and every pane owns its own scrolling.
 * That matters more than it looks: with an auto-height column the chat view's
 * `flex-1` panes and the preview iframe resolve `height: 100%` against a box
 * that grows with the content, so the preview rendered thousands of pixels tall
 * with the generated app far below the fold — indistinguishable from a blank
 * preview. `<main>` is the single scroll container for the content pages
 * (settings, dashboard, images), which scroll the whole column.
 */
export function AppShell({
  children,
  activeChatId,
}: {
  children: React.ReactNode;
  activeChatId?: string | null;
}) {
  const router = useRouter();
  const resetChat = useChatStore((state) => state.reset);
  const commandOpen = useUiStore((state) => state.commandOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const { isLoading } = useMe();

  const handleNewChat = React.useCallback(() => {
    resetChat();
    router.push('/studio');
  }, [resetChat, router]);

  // ⌘K / Ctrl-K opens the palette from anywhere in the studio.
  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [setCommandOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden h-full w-72 shrink-0 border-r border-border lg:block',
          isLoading && 'opacity-95',
        )}
      >
        <Sidebar onNewChat={handleNewChat} activeChatId={activeChatId} />
      </aside>

      {/* Routed content: one scroll container, with room for the mobile bottom nav. */}
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-16 scrollbar-thin lg:pb-0">
        {children}
      </main>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onNewChat={handleNewChat} />
    </div>
  );
}
