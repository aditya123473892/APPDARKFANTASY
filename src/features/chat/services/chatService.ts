import type { Conversation, Message, SendMessageInput } from '../types';

export interface ChatService {
  /** Participant lists; previews are loaded lazily from full histories. */
  listConversations(): Promise<Conversation[]>;
  /** Throws ServiceError('NOT_FOUND') when the conversation doesn't exist or isn't the viewer's. */
  getConversation(conversationId: string): Promise<Conversation>;
  /** Entire history; local windowing does not issue additional requests. */
  listMessages(conversationId: string): Promise<Message[]>;
  /** clientId is local correlation only. */
  sendMessage(input: SendMessageInput): Promise<Message>;
  editMessage(conversationId: string, messageId: string, newMessage: string): Promise<void>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  markRead(conversationId: string, allowed?: () => boolean): Promise<void>;
  /** Ephemeral typing indicator for the other participants. */
  setTyping(conversationId: string, isTyping: boolean): void;
}
