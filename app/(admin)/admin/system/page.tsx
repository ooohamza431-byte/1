import type { Metadata } from 'next';
import { Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { SystemPanel } from '@/components/admin/system-panel';

export const metadata: Metadata = {
  title: 'Admin · System',
  description: 'Environment diagnostics, instance defaults and a full JSON backup.',
};

export default function AdminSystemPage() {
  return (
    <>
      <PageHeader
        icon={<Settings2 />}
        title="System"
        description="Verify the deployment is wired up correctly, tune instance defaults and export a backup."
        className="mb-5"
      />
      <SystemPanel />
    </>
  );
}
