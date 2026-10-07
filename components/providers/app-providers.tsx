'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { getQueryClient } from '@/lib/query/client';
import { useUiStore } from '@/stores/ui';

/**
 * Client-side provider stack.
 *
 * Order matters: the session provider wraps everything so any nested hook can
 * call `useSession()`, and the theme sync runs first so the first paint already
 * has the right palette.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const applyTheme = useUiStore((state) => state.applyTheme);

  // Sync the store with whatever the inline boot script already applied.
  React.useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250} skipDelayDuration={400}>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
