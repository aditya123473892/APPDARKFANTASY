import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, serviceError, unwrap, type Envelope } from '@/services/api/backend';
import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';
import type { GodChatMessage } from '@/features/god-chat/godChatService';

export type GodSessionFilter = 'open' | 'live' | 'staff' | 'flagged' | 'ended' | 'all';
/** Why the server's guardrails flagged a message or chat. */
export type GodChatFlag =
  'self_harm' | 'unsafe' | 'injection' | 'sensitive_data' | 'output_blocked';
export const flagLabels: Record<GodChatFlag, string> = {
  self_harm: 'Self-harm',
  unsafe: 'Harmful request',
  injection: 'Tried to break the rules',
  sensitive_data: 'Shared a secret (removed)',
  output_blocked: 'AI reply blocked',
};
type Person = { id: string; name: string; username: string; avatar: string };
export type AdminGodSession = {
  id: string;
  mode: 'ai' | 'staff';
  /** False once the member started a new chat; it can no longer be taken over. */
  open: boolean;
  /** Had a message in the last few minutes. */
  live: boolean;
  updatedAt: string;
  user: Person;
  /** The admin currently answering, when taken over. */
  staff: Person | null;
  messageCount: number;
  lastMessage: GodChatMessage | null;
  /** Every flag the chat has raised. */
  flags: GodChatFlag[];
  /** Still waiting for an admin to review the flags. */
  flagged: boolean;
};
export type AdminGodMessage = GodChatMessage & { staffId?: string; flags?: GodChatFlag[] };
export type AdminGodSessionDetail = AdminGodSession & {
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
  flags?: GodChatFlag[];
  flagged?: boolean;
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
    flags: raw.flags ?? [],
    flagged: raw.flagged === true,
    messages: raw.messages ?? [],
  };
}

/** Pass `userId` to list only that member's chats, past and present. */
export async function listGodSessions(filter: GodSessionFilter, before?: string, userId?: string) {
  const data = await getData<{ sessions: BackendSession[]; next: string | null }>(
    '/admin/god-chat/sessions',
    { filter, ...(before ? { before } : {}), ...(userId ? { userId } : {}) },
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
/** The AI continues with the whole chat as context and answers anything left waiting. */
export const releaseGodSession = (id: string) => post(`/admin/god-chat/sessions/${id}/release`);
export const markGodSessionReviewed = (id: string) =>
  post(`/admin/god-chat/sessions/${id}/reviewed`);
/** Reuse the same message id when retrying so the reply is stored once. */
export const replyToGodSession = (id: string, messageId: string, content: string) =>
  post(`/admin/god-chat/sessions/${id}/messages`, { id: messageId, content });
