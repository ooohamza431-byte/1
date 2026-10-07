import type { Metadata } from 'next';
import { PageHeader } from '@/components/studio/top-bar';
import { AdminOverview } from '@/components/admin/overview';
import { LayoutDashboard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin overview',
  description: 'Instance health, usage and anything that needs attention.',
};

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader
        icon={<LayoutDashboard />}
        title="Overview"
        description="Health, spend and usage across the instance, plus anything that needs a decision."
        className="mb-5"
      />
      <AdminOverview />
    </>
  );
}
