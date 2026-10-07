import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { DashboardView } from '@/components/studio/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your usage, spend and recent activity.',
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        icon={<LayoutDashboard />}
        title="Dashboard"
        description="Your token usage, spend by provider and recent conversations."
        className="border-b border-border px-4 py-4 sm:px-6"
      />
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <DashboardView />
      </div>
    </>
  );
}
