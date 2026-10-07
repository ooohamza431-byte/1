import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { UsersTable } from '@/components/admin/users-table';

export const metadata: Metadata = {
  title: 'Admin · Users',
  description: 'Promote, ban, quota and inspect user accounts.',
};

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        icon={<Users />}
        title="Users"
        description="Roles, bans, quota overrides and read-only inspection. Every action here is audited."
        className="mb-5"
      />
      <UsersTable />
    </>
  );
}
