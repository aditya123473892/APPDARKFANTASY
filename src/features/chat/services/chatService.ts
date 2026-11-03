import type { Conversation, Message, SendMessageInput } from '../types';

export interface ChatService {
  /** Participant lists; previews are loaded lazily from full histories. */
  listConversations(): Promise<Conversation[]>;
  /** Throws ServiceError('NOT_FOUND') when the conversation doesn't exist or isn't the viewer's. */
  getConversation(conversationId: string): Promise<Conversation>;
  /** The newest page of history, merged with older pages already loaded. */
  listMessages(conversationId: string): Promise<Message[]>;
  /** Loads the page before the oldest cached message into the history cache. */
  loadOlderMessages(conversationId: string): Promise<void>;
  /** clientId is the server idempotency key, reused when the same send is retried. */
  sendMessage(input: SendMessageInput): Promise<Message>;
  editMessage(conversationId: string, messageId: string, newMessage: string): Promise<void>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  markRead(conversationId: string, allowed?: () => boolean): Promise<void>;
  /** Ephemeral typing indicator for the other participants; `false` clears it. */
  setTyping(conversationId: string, isTyping: boolean): void;
}
