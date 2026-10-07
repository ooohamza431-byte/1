import type { Metadata } from 'next';
import Link from 'next/link';
import { History, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/studio/top-bar';
import { HistoryList } from '@/components/studio/history-list';

export const metadata: Metadata = {
  title: 'History',
  description: 'Every conversation, with token and cost totals, searchable by message content.',
};

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        icon={<History />}
        title="History"
        description="Search titles and message bodies, export transcripts, or clean up old conversations."
        actions={
          <Button asChild size="sm">
            <Link href="/studio">
              <MessageSquarePlus /> New chat
            </Link>
          </Button>
        }
        className="border-b border-border px-4 py-4 sm:px-6"
      />

      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <HistoryList />
      </div>
    </>
  );
}
