import type { ChatService } from './chatService';
import { realChatService } from './chatService.real';

// Single implementation swap point. Replace with a real (REST + websocket) chat service during backend integration.
export const chatService: ChatService = realChatService;
