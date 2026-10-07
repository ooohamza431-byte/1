import { AppShell } from '@/components/studio/app-shell';
import { SessionGuard } from '@/components/studio/session-guard';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <AppShell>{children}</AppShell>
    </SessionGuard>
  );
}
