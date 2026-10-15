import type { Presence } from '@/types';

/** Server-confirmed delivery states. `sending` and `failed` only exist client-side in the outbox. */
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type LocalMessageStatus = MessageStatus | 'sending' | 'failed';

export type Message = {
  id: string;
  /** Idempotency key: the server stores a message once per key and echoes it back. */
  clientId?: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: MessageStatus;
  senderName?: string;
  media?: ChatMedia[];
};
export type ChatMedia = {
  _id: string;
  mimetype?: string;
  originalname?: string;
  status?: string;
  expiresAt?: string;
  revokedAt?: string;
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
  kind?: 'direct' | 'group';
  groupId?: string;
  ownerId?: string;
  memberCount?: number;
  description?: string;
};

export type SendMessageInput = {
  conversationId: string;
  text: string;
  clientId: string;
  assets?: import('@/features/feed/types').UploadAsset[];
};
