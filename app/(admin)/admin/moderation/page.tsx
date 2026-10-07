import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { ModerationView } from '@/components/admin/moderation-view';

export const metadata: Metadata = {
  title: 'Admin · Moderation',
  description: 'Blocked prompt patterns, flagged messages and a CSV export of chat logs.',
};

export default function AdminModerationPage() {
  return (
    <>
      <PageHeader
        icon={<ShieldAlert />}
        title="Moderation"
        description="Blocked patterns stop a prompt before it costs anything; flagged messages mark content for later review."
        className="mb-5"
      />
      <ModerationView />
    </>
  );
}
