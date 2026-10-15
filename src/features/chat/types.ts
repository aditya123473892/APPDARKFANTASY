import type { Presence } from '@/types';

export type MessageStatus = 'sent' | 'read';
export type LocalMessageStatus = MessageStatus | 'sending' | 'failed-definitive' | 'uncertain';

export type Message = {
  id: string;
  /** Local REST-response correlation only; never sent as an idempotency key. */
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
  lastMessage: {
    text: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
    status?: MessageStatus;
  } | null;
  previewState?: 'loading' | 'loaded' | 'error';
  historyLoaded?: boolean;
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
