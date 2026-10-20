import type { Presence } from '@/types';

export type MessageStatus = 'sent' | 'read';
export type LocalMessageStatus = MessageStatus | 'sending' | 'failed-definitive' | 'uncertain';

export type Message = {
  blockedSender?: boolean;
  id: string;
  /** Idempotency key: sent with each send attempt, echoed back on the viewer's own messages. */
  clientId?: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: MessageStatus;
  senderName?: string;
  media?: ChatMedia[];
  /** Disappearing message: the server stops returning it after this time. */
  expiresAt?: string;
  /** View-once media: the recipient can open it a single time. */
  viewOnce?: boolean;
  viewDurationSeconds?: number;
  /** When the recipient opened the view-once media. */
  viewedAt?: string;
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
  onUploadProgress?: import('@/services/api/uploadProgress').UploadProgressListener;
  conversationId: string;
  text: string;
  clientId: string;
  assets?: import('@/features/feed/types').UploadAsset[];
  /** Disappearing-message timer in seconds; one of MESSAGE_TIMERS. */
  ttlSeconds?: number;
  /** Send the single attachment as view-once (direct chats only). */
  viewOnce?: boolean;
  /** One opening that closes automatically after the photo loads. */
  viewDurationSeconds?: number;
};
