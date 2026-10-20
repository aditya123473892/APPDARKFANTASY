export type NotificationKind = 'connection' | 'request' | 'like' | 'reply' | 'message' | 'system';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  actor: { id: string; name: string; avatarUri: string };
  text: string;
  createdAt: string;
  read: boolean;
  /** Navigation targets, present depending on kind. */
  conversationId?: string;
  postId?: string;
  eventId?: string;
};
export type NotificationPage = { items: AppNotification[]; nextCursor?: string; unreadCount: number };
