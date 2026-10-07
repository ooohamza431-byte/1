import type { Metadata } from 'next';
import { ChatView } from '@/components/studio/chat-view';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Chat with nine AI providers through one interface, or build multi-file projects with six agents.',
};

export default function StudioPage() {
  return <ChatView />;
}
