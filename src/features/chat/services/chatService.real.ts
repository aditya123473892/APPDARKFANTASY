import type { UserSummary } from '@/features/auth/userModel';
import axios from 'axios';
import { featureFlags } from '@/config/featureFlags';
import { MESSAGE_TIMERS } from '../disappearing';
import { displayName } from '@/features/auth/userModel';
import { userCache } from '@/features/auth/userCache';
import { sessionIdentity, assertSessionCurrent } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import { uploadChatPhoto } from '@/services/api/photoUpload';
import { isClientId } from '@/utils/clientId';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { emitTyping, getHistory, refreshUnread, socketRequest, socketAck } from './socketSession';
import {
  isObjectId,
  mapMessage,
  parseMessage,
  parseUserSummary,
  type BackendMessage,
} from './chatPayload';
import { acceptUnread, markPeerRead, mergeMessage, unreadFor } from './chatState';
import type { ChatService } from './chatService';
import type { Conversation, Message } from '../types';
import { isPeerBlocked } from '@/features/safety/blockState';
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
    previewState: 'loading',
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
    previewState: 'loading',
    lastMessage: null,
    unreadCount: 0,
    presence: null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
const target = (key: string) => {
  const [kind, id] = key.split(':');
  if (!isObjectId(id) || !['group', 'user'].includes(kind ?? ''))
    throw new ServiceError('NOT_FOUND');
  if (kind === 'user' && isPeerBlocked(id)) throw new ServiceError('NOT_FOUND');
  return kind === 'group' ? { groupId: id } : { receiver: id };
};
function ownMessage(key: string, id: string): Message {
  const message = queryClient
    .getQueryData<Message[]>(queryKeys.messages(key))
    ?.find((row) => row.id === id);
  if (!message || message.senderId !== sessionIdentity.userId || !isObjectId(id))
    throw new ServiceError('FORBIDDEN');
  return message;
}

export const realChatService: ChatService = {
  async listConversations() {
    const scope = sessionIdentity.generation;
    const [people, groups] = await Promise.all([
      getData<{ userChatlist: unknown[] }>('/users/chatlist'),
      getData<BackendGroup[]>('/groups/my-groups'),
    ]);
    assertSessionCurrent(scope);
    if (!Array.isArray(people?.userChatlist) || !Array.isArray(groups))
      throw new ServiceError('UNKNOWN');
    const direct = people.userChatlist.map(parseUserSummary);
    if (direct.some((row) => !row)) throw new ServiceError('UNKNOWN');
    if (groups.some((group) => !group || !isObjectId(group._id) || typeof group.name !== 'string'))
      throw new ServiceError('UNKNOWN');
    const result = [
      ...direct
        .filter((row) => row && row._id !== sessionIdentity.userId && !isPeerBlocked(row._id))
        .map((row) => directConversation(row!)),
      ...groups.map(groupConversation),
    ];
    const current = queryClient.getQueryData<Conversation[]>(queryKeys.conversations) ?? [];
    for (const item of result) {
      const previous = current.find((row) => row.id === item.id);
      if (previous)
        Object.assign(item, {
          lastMessage: previous.lastMessage,
          updatedAt: previous.updatedAt,
          previewState: previous.previewState,
          historyLoaded: previous.historyLoaded,
        });
      item.unreadCount = unreadFor(item.id);
    }
    void refreshUnread().catch(() => undefined);
    return result;
  },
  async getConversation(key) {
    target(key);
    const scope = sessionIdentity.generation;
    const cached = queryClient
      .getQueryData<Conversation[]>(queryKeys.conversations)
      ?.find((row) => row.id === key);
    const [kind, id] = key.split(':');
    if (!isObjectId(id)) throw new ServiceError('NOT_FOUND');
    if (kind === 'user') {
      // A cached summary cannot establish that this peer is still visible.
      const result = await getData<{ user: unknown }>(`/users/${id}`);
      assertSessionCurrent(scope);
      target(key);
      const user = parseUserSummary(result.user);
      if (!user) throw new ServiceError('NOT_FOUND');
      return cached
        ? { ...cached, participant: directConversation(user).participant }
        : directConversation(user);
    }
    if (cached) return cached;
    if (kind !== 'group') throw new ServiceError('NOT_FOUND');
    const groups = await getData<BackendGroup[]>('/groups/my-groups');
    assertSessionCurrent(scope);
    const group = groups.find((row) => row._id === id);
    if (!group) throw new ServiceError('NOT_FOUND');
    return groupConversation(group);
  },
  listMessages: getHistory,
  async editMessage(key, id, text) {
    const scope = sessionIdentity.generation;
    const message = ownMessage(key, id);
    if (!text.trim() || text.length > 2000 || message.media?.length)
      throw new ServiceError('VALIDATION');
    const raw = await socketAck('updateMessage', { messageId: id, newMessage: text.trim() });
    assertSessionCurrent(scope);
    const parsed = parseMessage(raw);
    if (!parsed || parsed._id !== id) throw new ServiceError('UNKNOWN');
    mergeMessage(mapMessage(parsed, key));
  },
  async deleteMessage(key, id) {
    const scope = sessionIdentity.generation;
    ownMessage(key, id);
    const raw = await socketRequest<unknown>(
      'deleteMessage',
      'messageDeleted',
      { messageId: id },
      undefined,
      (value) =>
        Boolean(
          value && typeof value === 'object' && 'messageId' in value && value.messageId === id,
        ),
    );
    assertSessionCurrent(scope);
    const parsed = parseMessage(raw);
    if (!parsed || parsed._id !== id) throw new ServiceError('UNKNOWN');
    mergeMessage(mapMessage(parsed, key), true);
  },
  async sendMessage(input) {
    const scope = sessionIdentity.generation;
    assertSessionCurrent(scope);
    const to = target(input.conversationId);
    if (input.ttlSeconds && !featureFlags.ENABLE_EPHEMERAL_CHAT)
      throw new ServiceError('VALIDATION', 'This backend does not support disappearing messages.');
    if (input.ttlSeconds && !MESSAGE_TIMERS.some((timer) => timer.seconds === input.ttlSeconds))
      throw new ServiceError('VALIDATION');
    if (
      (input.viewOnce || input.viewDurationSeconds) &&
      (!input.conversationId.startsWith('user:') || input.assets?.length !== 1)
    )
      throw new ServiceError('VALIDATION');
    if (input.viewDurationSeconds && ![3, 10, 30, 60].includes(input.viewDurationSeconds))
      throw new ServiceError('VALIDATION');
    try {
      const payload = {
        ...to,
        message: input.text,
        // Retries reuse the key so the server stores the message once.
        ...(isClientId(input.clientId) ? { clientId: input.clientId } : {}),
        ...(input.ttlSeconds ? { ttlSeconds: input.ttlSeconds } : {}),
        ...(input.viewOnce || input.viewDurationSeconds ? { viewOnce: true } : {}),
        ...(input.viewDurationSeconds ? { viewDurationSeconds: input.viewDurationSeconds } : {}),
      };
      const photoIds: string[] = [];
      for (const asset of input.assets || []) photoIds.push(await uploadChatPhoto(asset, input.onUploadProgress));
      assertSessionCurrent(scope);
      const response = await apiClient.post('/chats/messages', {
        ...payload,
        ...(photoIds.length ? { photoIds } : {}),
      });
      assertSessionCurrent(scope);
      if (Number(response.data?.statusCode) >= 500) throw new ServiceError('UNKNOWN');
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
      if (axios.isAxiosError(error)) {
        const status = Number(error.response?.data?.statusCode ?? error.response?.status);
        if (status === 403) throw new ServiceError('FORBIDDEN');
        if (status === 404) throw new ServiceError('NOT_FOUND');
        if ([400, 409, 422].includes(status))
          throw new ServiceError(status === 409 ? 'CONFLICT' : 'VALIDATION');
        if (status >= 500) throw new ServiceError('UNKNOWN');
      }
      throw serviceError(error);
    }
  },
  async markRead(key, allowed) {
    const scope = sessionIdentity.generation;
    if (key.startsWith('group:')) {
      const groupId = key.slice(6);
      if (!isObjectId(groupId)) throw new ServiceError('NOT_FOUND');
      // This backend has no per-member group read cursor. Do not enqueue an
      // unsupported event: its timeout would reconnect and stall other requests.
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
    const [kind, id] = key.split(':');
    if (kind === 'user') emitTyping({ receiver: id ?? '', isTyping });
    else if (kind === 'group') emitTyping({ groupId: id ?? '', isTyping });
  },
};
