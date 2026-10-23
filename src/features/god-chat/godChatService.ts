import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { getData, serviceError, unwrap, type Envelope } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';

export type GodChatRole = 'user' | 'assistant';
export type GodChatMessage = { id: string; role: GodChatRole; content: string };

/** Mirrors the backend limits so requests are never rejected for size. */
export const GOD_CHAT_MAX_CHARS = 1000;
const MAX_TURNS = 12;
const MAX_REPLY_CHARS = 4000;

export async function godChatAvailable(): Promise<boolean> {
  const data = await getData<{ available?: boolean }>('/god-chat/status');
  return data.available === true;
}

export async function askGod(history: GodChatMessage[]): Promise<string> {
  const messages = history.slice(-MAX_TURNS).map(({ role, content }) => ({
    role,
    content: content.slice(0, role === 'user' ? GOD_CHAT_MAX_CHARS : MAX_REPLY_CHARS),
  }));
  // The history must start with the user so trimming never leaves a dangling reply first.
  while (messages[0]?.role === 'assistant') messages.shift();
  try {
    const response = await apiClient.post<Envelope<{ reply?: string }>>(
      '/god-chat',
      { messages },
      { timeout: 35_000 },
    );
    const reply = unwrap(response.data).reply;
    if (typeof reply !== 'string' || !reply.trim()) throw new ServiceError('UNKNOWN');
    return reply.trim();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 503)
        throw new ServiceError('VALIDATION', 'God is resting right now. Please try again later.');
      if (status === 429)
        throw new ServiceError('VALIDATION', 'Too many messages. Wait a moment, then try again.');
      if (error.code === 'ECONNABORTED')
        throw new ServiceError('VALIDATION', 'God took too long to answer. Please try again.');
    }
    throw serviceError(error);
  }
}
