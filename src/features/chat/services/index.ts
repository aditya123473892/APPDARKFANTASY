import type { ChatService } from './chatService';
import { mockChatService } from './chatService.mock';

// Single implementation swap point. Replace with a real (REST + websocket) chat service during backend integration.
export const chatService: ChatService = mockChatService;
