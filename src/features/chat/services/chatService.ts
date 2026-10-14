import type { Conversation, Message, SendMessageInput } from '../types';

export interface ChatService {
  listConversations(): Promise<Conversation[]>;
  /** Throws ServiceError('NOT_FOUND') when the conversation doesn't exist or isn't the viewer's. */
  getConversation(conversationId: string): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  /** clientId is local correlation. The current backend does not provide idempotency. */
  sendMessage(input: SendMessageInput): Promise<Message>;
  markRead(conversationId: string, allowed?: () => boolean): Promise<void>;
}
