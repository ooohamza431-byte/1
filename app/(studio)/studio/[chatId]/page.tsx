import type { Metadata } from 'next';
import { ChatLoader } from '@/components/studio/chat-loader';

export const metadata: Metadata = {
  title: 'Chat',
};

/**
 * Reopens an existing conversation.
 *
 * The message history is loaded client-side (the store already owns the shape)
 * rather than server-rendered, because the same store has to accept live SSE
 * updates a moment later — hydrating it twice would cause a flash.
 */
export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <ChatLoader chatId={chatId} />;
}
