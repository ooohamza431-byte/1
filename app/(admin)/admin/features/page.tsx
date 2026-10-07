import type { Metadata } from 'next';
import { Flag } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { FeaturesGrid } from '@/components/admin/features-grid';

export const metadata: Metadata = {
  title: 'Admin · Feature flags',
  description: 'Kill switches and beta gates, enforced server-side on the next request.',
};

export default function AdminFeaturesPage() {
  return (
    <>
      <PageHeader
        icon={<Flag />}
        title="Feature flags"
        description="Turn capabilities on or off without a redeploy. Maintenance mode stops generation for everyone except owners."
        className="mb-5"
      />
      <FeaturesGrid />
    </>
  );
}
