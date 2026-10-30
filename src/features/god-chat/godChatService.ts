import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { getData, serviceError, unwrap, type Envelope } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';

export type GodChatRole = 'user' | 'assistant';
/** Who wrote a message: the member, the AI, or a DARKFANTASY team member who took over. */
export type GodChatAuthor = 'user' | 'ai' | 'staff' | 'system';
export type GodChatMessage = {
  id: string;
  /** 'event' rows are notices such as "a team member joined". */
  role: GodChatRole | 'event';
  by: GodChatAuthor;
  content: string;
  at: string;
};
export type GodChatSession = {
  id: string;
  /** 'staff' while an admin has taken over; the AI does not answer then. */
  mode: 'ai' | 'staff';
  /** False for a past chat the member closed with "New chat". */
  open?: boolean;
  createdAt?: string;
  closedAt?: string | null;
  messages: GodChatMessage[];
};
/** A closed chat in the member's history list. */
export type PastGodChat = {
  id: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messageCount: number;
  /** The member's first message. */
  preview: string;
};

/** Mirrors the backend limit so requests are never rejected for size. */
export const GOD_CHAT_MAX_CHARS = 1000;

function godChatError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 503)
      return new ServiceError('VALIDATION', 'God is resting right now. Please try again later.');
    if (status === 429)
      return new ServiceError('VALIDATION', 'Too many messages. Wait a moment, then try again.');
    if (error.code === 'ECONNABORTED')
      return new ServiceError('VALIDATION', 'God took too long to answer. Please try again.');
  }
  return serviceError(error);
}

export async function godChatAvailable(): Promise<boolean> {
  const data = await getData<{ available?: boolean }>('/god-chat/status');
  return data.available === true;
}

export async function loadGodSession(): Promise<GodChatSession | null> {
  const data = await getData<{ session?: GodChatSession | null }>('/god-chat/session');
  return data.session ?? null;
}

/** Past chats, newest first; pass the previous page's `next` to load older ones. */
export async function loadGodHistory(before?: string) {
  const data = await getData<{ sessions: PastGodChat[]; next: string | null }>(
    '/god-chat/history',
    before ? { before } : undefined,
  );
  return { sessions: data.sessions, next: data.next ?? undefined };
}

export async function loadPastGodChat(id: string): Promise<GodChatSession | null> {
  const data = await getData<{ session?: GodChatSession | null }>(`/god-chat/history/${id}`);
  return data.session ?? null;
}

/** Reuse the same id when retrying so the server stores the message once. */
export async function sendToGod(id: string, content: string): Promise<GodChatSession | null> {
  try {
    const response = await apiClient.post<Envelope<{ session?: GodChatSession | null }>>(
      '/god-chat/messages',
      { id, content: content.slice(0, GOD_CHAT_MAX_CHARS) },
      { timeout: 135_000 },
    );
    return unwrap(response.data).session ?? null;
  } catch (error) {
    throw godChatError(error);
  }
}

export async function startNewGodChat(): Promise<void> {
  try {
    unwrap((await apiClient.post<Envelope<unknown>>('/god-chat/session/new')).data);
  } catch (error) {
    throw serviceError(error);
  }
}
