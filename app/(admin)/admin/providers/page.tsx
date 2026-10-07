import type { Metadata } from 'next';
import { Workflow } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { ProvidersTable } from '@/components/admin/providers-table';

export const metadata: Metadata = {
  title: 'Admin · Providers',
  description: 'Enable providers, pin per-agent models, set the fallback order and add custom endpoints.',
};

export default function AdminProvidersPage() {
  return (
    <>
      <PageHeader
        icon={<Workflow />}
        title="Providers"
        description="Enable or disable providers, pin a model per agent, reorder the fallback chain and register custom OpenAI-compatible endpoints."
        className="mb-5"
      />
      <ProvidersTable />
    </>
  );
}
