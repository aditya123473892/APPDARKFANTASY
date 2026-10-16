import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';
import { userCache, senderId } from '@/features/auth/userCache';
import { sessionIdentity, assertSessionCurrent } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { isServiceError, ServiceError } from '@/services/errors';
import { appendAsset } from '@/services/api/multipart';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import {
  emitTyping,
  getHistory,
  getOlderHistory,
  refreshUnread,
  socketAck,
  socketRequest,
} from './socketSession';
import {
  conversationKey,
  isObjectId,
  mapMessage,
  parseMessage,
  parseUserSummary,
  previewText,
  type BackendMessage,
} from './chatPayload';
import {
  acceptServerUnread,
  acceptUnread,
  hasOlderHistory,
  markGroupRead,
  markPeerRead,
  mergeMessage,
  unreadFor,
} from './chatState';
import type { ChatService } from './chatService';
import type { Conversation, Message } from '../types';
export { conversationKey, mapMessage } from './chatPayload';
export type { BackendMessage } from './chatPayload';
export type BackendGroup = {
  _id: string;
  name: string;
  description?: string;
  groupIcon?: string;
  admin: string;
  members?: (string | UserSummary)[];
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
};
type BackendConversation =
  | {
      id: string;
      kind: 'direct';
      peer: UserSummary & { isOnline?: boolean; lastSeen?: string };
      lastMessage: unknown;
      unreadCount: number;
      updatedAt: string;
    }
  | {
      id: string;
      kind: 'group';
      group: BackendGroup;
      lastMessage: unknown;
      unreadCount: number;
      updatedAt: string;
    };
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function directConversation(user: UserSummary): Conversation {
  userCache.put(user);
  return {
    id: `user:${user._id}`,
    kind: 'direct',
    participant: {
      id: user._id,
      name: displayName(user),
      avatarUri: mediaUrl(user.avatar),
      age: 0,
    },
    lastMessage: null,
    unreadCount: 0,
    presence: null,
    createdAt: '',
    updatedAt: '',
  };
}
export function groupConversation(group: BackendGroup): Conversation {
  return {
    id: `group:${group._id}`,
    kind: 'group',
    groupId: group._id,
    ownerId: String(group.admin),
    memberCount: group.memberCount ?? group.members?.length ?? 0,
    description: group.description || undefined,
    participant: { id: group._id, name: group.name, avatarUri: mediaUrl(group.groupIcon), age: 0 },
    lastMessage: null,
    unreadCount: 0,
    presence: null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
function preview(value: unknown, key: string): Conversation['lastMessage'] {
  const raw = parseMessage(value);
  if (!raw || conversationKey(raw) !== key) return null;
  return {
    text: previewText(raw),
    senderId: senderId(raw.sender),
    createdAt: raw.sentAt,
  };
}
function mapConversation(row: BackendConversation): Conversation | null {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') return null;
  let conversation: Conversation;
  if (row.kind === 'group') {
    if (!row.group || !isObjectId(row.group._id) || typeof row.group.name !== 'string') return null;
    conversation = groupConversation(row.group);
  } else if (row.kind === 'direct') {
    const peer = parseUserSummary(row.peer);
    if (!peer) return null;
    conversation = directConversation(peer);
    if (typeof row.peer.isOnline === 'boolean')
      conversation.presence = { online: row.peer.isOnline, lastSeenAt: row.peer.lastSeen ?? null };
  } else return null;
  if (conversation.id !== row.id) return null;
  conversation.lastMessage = preview(row.lastMessage, row.id);
  if (typeof row.updatedAt === 'string') conversation.updatedAt = row.updatedAt;
  return conversation;
}
const target = (key: string) => {
  const [kind, id] = key.split(':');
  if (!isObjectId(id) || !['group', 'user'].includes(kind ?? ''))
    throw new ServiceError('NOT_FOUND');
  return kind === 'group' ? { groupId: id } : { receiver: id };
};

export const realChatService: ChatService = {
  async listConversations() {
    const scope = sessionIdentity.generation;
    const [data, unread] = await Promise.all([
      getData<{ conversations: BackendConversation[] }>('/chats/conversations'),
      socketRequest<BackendMessage[]>('getUnreadCount', 'unreadMessageCount').catch((error) => {
        // The REST inbox stays usable while realtime reconnects: the server's
        // counts are used until a realtime unread list arrives.
        if (isServiceError(error, 'NETWORK')) return undefined;
        throw error;
      }),
    ]);
    assertSessionCurrent(scope);
    if (!Array.isArray(data?.conversations)) throw new ServiceError('UNKNOWN');
    const rows = data.conversations.map(mapConversation);
    if (rows.some((row) => !row)) throw new ServiceError('UNKNOWN');
    const result = rows as Conversation[];
    const groupCounts = new Map<string, number>();
    const directCounts = new Map<string, number>();
    data.conversations.forEach((row) => {
      const count = Number.isInteger(row.unreadCount) && row.unreadCount > 0 ? row.unreadCount : 0;
      (row.kind === 'group' ? groupCounts : directCounts).set(row.id, count);
    });
    if (unread !== undefined && !acceptUnread(unread)) throw new ServiceError('UNKNOWN');
    acceptServerUnread(unread === undefined ? directCounts : null, groupCounts);
    for (const conversation of result) {
      conversation.unreadCount = unreadFor(conversation.id);
      // A live message newer than the server snapshot wins.
      const history = queryClient.getQueryData<Message[]>(queryKeys.messages(conversation.id));
      const latest = history?.[history.length - 1];
      if (
        latest &&
        (!conversation.lastMessage ||
          Date.parse(latest.createdAt) > Date.parse(conversation.lastMessage.createdAt))
      ) {
        conversation.lastMessage = {
          text: previewText(latest),
          senderId: latest.senderId,
          createdAt: latest.createdAt,
        };
        conversation.updatedAt = latest.createdAt;
      }
    }
    return result.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  },
  async getConversation(key) {
    const scope = sessionIdentity.generation;
    const [kind, id] = key.split(':');
    if (!/^[a-f\d]{24}$/i.test(id ?? '')) throw new ServiceError('NOT_FOUND');
    if (kind === 'group') {
      const group = await getData<BackendGroup>(`/groups/${id}/members`);
      assertSessionCurrent(scope);
      return groupConversation(group);
    }
    if (kind !== 'user') throw new ServiceError('NOT_FOUND');
    const { user } = await getData<{ user: UserSummary }>(`/users/${id}`);
    assertSessionCurrent(scope);
    const safe = parseUserSummary(user);
    if (!safe) throw new ServiceError('UNKNOWN');
    return directConversation(safe);
  },
  listMessages: getHistory,
  async loadOlderMessages(key) {
    const scope = sessionIdentity.generation;
    const oldest = queryClient.getQueryData<Message[]>(queryKeys.messages(key))?.[0];
    if (!oldest) return false;
    await getOlderHistory(key, oldest.id);
    assertSessionCurrent(scope);
    return hasOlderHistory(key);
  },
  async sendMessage(input) {
    const scope = sessionIdentity.generation;
    assertSessionCurrent(scope);
    const to = target(input.conversationId);
    const clientId = CLIENT_ID.test(input.clientId) ? input.clientId : undefined;
    try {
      const payload = {
        ...to,
        message: input.text,
        ...(clientId ? { clientId } : {}),
        ...(input.ttlSeconds ? { ttlSeconds: input.ttlSeconds } : {}),
        ...(input.viewOnce ? { viewOnce: true } : {}),
      };
      let body: FormData | typeof payload = payload;
      if (input.assets?.length) {
        const form = new FormData();
        for (const [field, value] of Object.entries(payload)) form.append(field, String(value));
        input.assets.forEach((asset) => appendAsset(form, asset));
        body = form;
      }
      const response = await apiClient.post(
        '/chats/messages',
        body,
        input.assets?.length
          ? { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
          : undefined,
      );
      assertSessionCurrent(scope);
      const message: Message = {
        ...mapMessage(unwrap<BackendMessage>(response.data), input.conversationId),
        clientId: input.clientId,
      };
      mergeMessage(message);
      // A successful send stays successful even when the unread refresh is offline.
      void refreshUnread().catch(() => undefined);
      return message;
    } catch (error) {
      assertSessionCurrent(scope);
      throw serviceError(error);
    }
  },
  async markRead(key, allowed) {
    const scope = sessionIdentity.generation;
    if (key.startsWith('group:')) {
      // Group read cursors are private: they clear the viewer's own unread count.
      const groupId = key.slice(6);
      if (!isObjectId(groupId)) throw new ServiceError('NOT_FOUND');
      const reply = await socketAck<{ groupId?: string }>('markGroupAsRead', { groupId }, allowed);
      assertSessionCurrent(scope);
      if (reply?.groupId !== groupId) throw new ServiceError('UNKNOWN');
      markGroupRead(key);
      return;
    }
    const unread = await socketRequest(
      'markAsRead',
      'unreadMessageCount',
      { user2: key.split(':')[1] },
      allowed,
    );
    assertSessionCurrent(scope);
    if (!acceptUnread(unread)) throw new ServiceError('UNKNOWN');
    markPeerRead(key);
  },
  setTyping(key, isTyping) {
    try {
      emitTyping({ ...target(key), isTyping });
    } catch {
      // Typing is best effort; an invalid key has nothing to notify.
    }
  },
};
