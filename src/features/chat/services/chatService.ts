import type { Conversation, Message, SendMessageInput } from '../types';

export interface ChatService {
  listConversations(): Promise<Conversation[]>;
  /** Throws ServiceError('NOT_FOUND') when the conversation doesn't exist or isn't the viewer's. */
  getConversation(conversationId: string): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  /** Must be idempotent per `clientId` so retries never create duplicates. */
  sendMessage(input: SendMessageInput): Promise<Message>;
  markRead(conversationId: string): Promise<void>;
}
