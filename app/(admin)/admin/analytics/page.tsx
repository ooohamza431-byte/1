import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { AnalyticsView } from '@/components/admin/analytics-view';

export const metadata: Metadata = {
  title: 'Admin · Analytics',
  description: 'Spend, latency percentiles, error rates and per-user cost.',
};

export default function AdminAnalyticsPage() {
  return (
    <>
      <PageHeader
        icon={<BarChart3 />}
        title="Analytics"
        description="Spend, token volume, latency percentiles and error rates per provider, plus a per-user cost table you can export."
        className="mb-5"
      />
      <AnalyticsView />
    </>
  );
}
