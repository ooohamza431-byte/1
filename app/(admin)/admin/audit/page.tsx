import type { Metadata } from 'next';
import { Activity } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { AuditTable } from '@/components/admin/audit-table';

export const metadata: Metadata = {
  title: 'Admin · Audit log',
  description: 'Every administrative action, attributed and timestamped.',
};

export default function AdminAuditPage() {
  return (
    <>
      <PageHeader
        icon={<Activity />}
        title="Audit log"
        description="Who did what, to whom, and when — including key rotations, bans, role changes, feature toggles and database exports."
        className="mb-5"
      />
      <AuditTable />
    </>
  );
}
