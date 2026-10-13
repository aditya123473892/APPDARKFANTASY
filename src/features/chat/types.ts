import type { Presence } from '@/types';

/** Server-confirmed delivery states. `sending` and `failed` only exist client-side in the outbox. */
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type LocalMessageStatus = MessageStatus | 'sending' | 'failed';

export type Message = {
  id: string;
  /** Client-generated id echoed back by the server so retries are idempotent. */
  clientId?: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: MessageStatus;
};

export type ChatParticipant = { id: string; name: string; age: number; avatarUri: string };

export type Conversation = {
  id: string;
  participant: ChatParticipant;
  lastMessage: { text: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  presence: Presence | null;
  createdAt: string;
  updatedAt: string;
};

export type SendMessageInput = { conversationId: string; text: string; clientId: string };
