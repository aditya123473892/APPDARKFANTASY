import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, serviceError, unwrap, type Envelope } from '@/services/api/backend';
import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';
import type { GodChatMessage } from '@/features/god-chat/godChatService';

export type GodSessionFilter = 'open' | 'live' | 'staff';
type Person = { id: string; name: string; username: string; avatar: string };
export type AdminGodSession = {
  id: string;
  mode: 'ai' | 'staff';
  /** Had a message in the last few minutes. */
  live: boolean;
  updatedAt: string;
  user: Person;
  /** The admin currently answering, when taken over. */
  staff: Person | null;
  messageCount: number;
  lastMessage: GodChatMessage | null;
};
export type AdminGodMessage = GodChatMessage & { staffId?: string };
export type AdminGodSessionDetail = AdminGodSession & {
  /** False once the member started a new chat; it can no longer be taken over. */
  open: boolean;
  messages: AdminGodMessage[];
};

type BackendPerson = UserSummary & { _id: string };
type BackendSession = {
  _id: string;
  mode: 'ai' | 'staff';
  live: boolean;
  updatedAt: string;
  user?: BackendPerson;
  staff?: BackendPerson;
  messageCount?: number;
  lastMessage?: GodChatMessage;
  open?: boolean;
  messages?: AdminGodMessage[];
};

const person = (raw?: BackendPerson): Person =>
  raw
    ? {
        id: raw._id,
        name: displayName(raw),
        username: raw.username ?? '',
        avatar: mediaUrl(raw.avatar),
      }
    : { id: '', name: 'Deleted member', username: '', avatar: '' };

function mapSession(raw: BackendSession): AdminGodSessionDetail {
  return {
    id: raw._id,
    mode: raw.mode,
    live: raw.live,
    updatedAt: raw.updatedAt,
    user: person(raw.user),
    staff: raw.staff ? person(raw.staff) : null,
    messageCount: raw.messageCount ?? raw.messages?.length ?? 0,
    lastMessage: raw.lastMessage ?? null,
    open: raw.open !== false,
    messages: raw.messages ?? [],
  };
}

export async function listGodSessions(filter: GodSessionFilter, before?: string) {
  const data = await getData<{ sessions: BackendSession[]; next: string | null }>(
    '/admin/god-chat/sessions',
    { filter, ...(before ? { before } : {}) },
  );
  return { sessions: data.sessions.map(mapSession), next: data.next ?? undefined };
}

export async function godSessionDetail(id: string) {
  return mapSession(await getData<BackendSession>(`/admin/god-chat/sessions/${id}`));
}

async function post(url: string, body?: unknown) {
  try {
    return mapSession(unwrap((await apiClient.post<Envelope<BackendSession>>(url, body)).data));
  } catch (error) {
    throw serviceError(error);
  }
}

export const takeOverGodSession = (id: string) => post(`/admin/god-chat/sessions/${id}/takeover`);
export const releaseGodSession = (id: string) => post(`/admin/god-chat/sessions/${id}/release`);
/** Reuse the same message id when retrying so the reply is stored once. */
export const replyToGodSession = (id: string, messageId: string, content: string) =>
  post(`/admin/god-chat/sessions/${id}/messages`, { id: messageId, content });
