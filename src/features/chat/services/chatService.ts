import type { Conversation, Message, SendMessageInput } from '../types';

export interface ChatService {
  /** Direct and group conversations with server-side last message and unread counts. */
  listConversations(): Promise<Conversation[]>;
  /** Throws ServiceError('NOT_FOUND') when the conversation doesn't exist or isn't the viewer's. */
  getConversation(conversationId: string): Promise<Conversation>;
  /** The newest page of messages; older pages are added with loadOlderMessages. */
  listMessages(conversationId: string): Promise<Message[]>;
  /** Loads the page before the oldest loaded message. Resolves whether even older messages may exist. */
  loadOlderMessages(conversationId: string): Promise<boolean>;
  /** clientId is an idempotency key: retrying with the same key never stores a second message. */
  sendMessage(input: SendMessageInput): Promise<Message>;
  markRead(conversationId: string, allowed?: () => boolean): Promise<void>;
  /** Ephemeral typing indicator for the other participants. */
  setTyping(conversationId: string, isTyping: boolean): void;
}
