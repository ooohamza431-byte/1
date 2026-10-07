import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { KeysTable } from '@/components/admin/keys-table';

export const metadata: Metadata = {
  title: 'Admin · API keys',
  description: 'Shared server keys that let every user generate with zero setup.',
};

export default function AdminKeysPage() {
  return (
    <>
      <PageHeader
        icon={<KeyRound />}
        title="Server API keys"
        description="One shared key per provider unlocks the whole instance. Users with their own key always use it first."
        className="mb-5"
      />
      <KeysTable />
    </>
  );
}
