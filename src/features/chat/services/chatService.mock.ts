import { db, respond } from '@/mocks/db';
import { ServiceError } from '@/services/errors';
import type { ChatService } from './chatService';

/** Message text that makes the mock reject a send, to exercise the failed/retry UI. */
export const MOCK_FAIL_MESSAGE = '/fail';

export const mockChatService: ChatService = {
  listConversations: () => respond(() => db.conversations()),
  getConversation: (conversationId) => respond(() => db.conversation(conversationId), 250),
  listMessages: (conversationId) => respond(() => db.messages(conversationId)),
  // The fixture database returns whole conversations in one page.
  loadOlderMessages: () => respond(() => false),
  setTyping: () => {},
  sendMessage: ({ conversationId, text, clientId }) =>
    respond(() => {
      if (text.trim() === MOCK_FAIL_MESSAGE)
        throw new ServiceError('NETWORK', 'Simulated send failure');
      return db.sendMessage(conversationId, text, clientId);
    }, 450),
  markRead: (conversationId) => respond(() => db.markRead(conversationId), 150),
};
