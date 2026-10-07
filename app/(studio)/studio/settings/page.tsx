import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/studio/top-bar';
import { SettingsForm } from '@/components/studio/settings-form';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Profile, appearance, usage and provider diagnostics.',
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        icon={<Settings />}
        title="Settings"
        description="Your profile, appearance preferences, usage and the state of every provider."
        className="border-b border-border px-4 py-4 sm:px-6"
      />
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <SettingsForm />
      </div>
    </>
  );
}
