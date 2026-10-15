import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';
import { userCache } from '@/features/auth/userCache';
import { sessionIdentity, assertSessionCurrent } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import { appendAsset } from '@/services/api/multipart';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { emitTyping, getHistory, refreshUnread, socketRequest } from './socketSession';
import {
  isObjectId,
  mapMessage,
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
  async loadOlderMessages() {
    return false;
  },
  async sendMessage(input) {
    const scope = sessionIdentity.generation;
    assertSessionCurrent(scope);
    const to = target(input.conversationId);
    try {
      const payload = { ...to, message: input.text };
      let body: FormData | typeof payload = payload;
      if (input.assets?.length) {
        const form = new FormData();
        for (const [field, value] of Object.entries(payload)) form.append(field, value);
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
    if (key.startsWith('group:')) return;
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
