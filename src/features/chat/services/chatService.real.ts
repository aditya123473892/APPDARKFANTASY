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
import { uploadPhoto } from '@/services/api/photoUpload';
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
        .filter((row) => row && row._id !== sessionIdentity.userId)
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
    for (const item of current)
      if (!result.some((row) => row.id === item.id) && item.lastMessage) result.push(item);
    void refreshUnread().catch(() => undefined);
    return result;
  },
  async getConversation(key) {
    const scope = sessionIdentity.generation;
    const cached = queryClient
      .getQueryData<Conversation[]>(queryKeys.conversations)
      ?.find((row) => row.id === key);
    if (cached) return cached;
    const [kind, id] = key.split(':');
    if (!isObjectId(id)) throw new ServiceError('NOT_FOUND');
    if (kind === 'user') {
      const user = userCache.get(id);
      if (!user) throw new ServiceError('NOT_FOUND');
      return directConversation(user);
    }
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
    if ((input.ttlSeconds || input.viewOnce) && !featureFlags.ENABLE_EPHEMERAL_CHAT)
      throw new ServiceError(
        'VALIDATION',
        'This backend does not support disappearing or view-once messages.',
      );
    if (input.ttlSeconds && !MESSAGE_TIMERS.some((timer) => timer.seconds === input.ttlSeconds))
      throw new ServiceError('VALIDATION');
    if (input.viewOnce && (!input.conversationId.startsWith('user:') || input.assets?.length !== 1))
      throw new ServiceError('VALIDATION');
    try {
      const payload = {
        ...to,
        message: input.text,
        // Retries reuse the key so the server stores the message once.
        ...(isClientId(input.clientId) ? { clientId: input.clientId } : {}),
        ...(input.ttlSeconds ? { ttlSeconds: input.ttlSeconds } : {}),
        ...(input.viewOnce ? { viewOnce: true } : {}),
      };
      const photoIds: string[] = [];
      for (const asset of input.assets || []) photoIds.push(await uploadPhoto(asset));
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
      // Moves the viewer's private read cursor; the server syncs their other devices.
      const reply = await socketAck<{ groupId?: unknown }>(
        'markGroupAsRead',
        { groupId },
        allowed,
        true,
      );
      assertSessionCurrent(scope);
      if (reply?.groupId !== groupId) throw new ServiceError('UNKNOWN');
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
