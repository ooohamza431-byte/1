import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { KeysManager } from '@/components/studio/keys-manager';

export const metadata: Metadata = {
  title: 'API keys',
  description: 'Bring your own provider keys. Encrypted at rest; your key is always tried before a shared server key.',
};

export default function KeysPage() {
  return (
    <>
      <PageHeader
        icon={<KeyRound />}
        title="API keys"
        description="Add your own provider keys to run requests on your account. An admin-provided server key is used only as a fallback."
        className="border-b border-border px-4 py-4 sm:px-6"
      />
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <KeysManager />
      </div>
    </>
  );
}
