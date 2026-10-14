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
import { joinGroup, getHistory, socketRequest, refreshUnread } from './socketSession';
import { mapMessage, parseUserSummary, type BackendMessage } from './chatPayload';
import { acceptUnread, mergeMessage, markPeerRead, unreadFor } from './chatState';
import type { ChatService } from './chatService';
import type { Conversation, Message } from '../types';
export { conversationKey, mapMessage } from './chatPayload';
export type { BackendMessage } from './chatPayload';
export type BackendGroup = {
  _id: string;
  name: string;
  groupIcon?: string;
  admin: string;
  members: (string | UserSummary)[];
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
    ownerId: group.admin,
    memberCount: group.members.length,
    participant: { id: group._id, name: group.name, avatarUri: mediaUrl(group.groupIcon), age: 0 },
    lastMessage: null,
    unreadCount: 0,
    presence: null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
export const realChatService: ChatService = {
  async listConversations() {
    const scope = sessionIdentity.generation;
    const [users, groups, unread] = await Promise.all([
      getData<{ userChatlist: UserSummary[] }>('/users/chatlist'),
      getData<BackendGroup[]>('/groups/my-groups'),
      socketRequest<BackendMessage[]>('getUnreadCount', 'unreadMessageCount'),
    ]);
    assertSessionCurrent(scope);
    if (!acceptUnread(unread) || !Array.isArray(users.userChatlist) || !Array.isArray(groups))
      throw new ServiceError('UNKNOWN');
    const summaries = users.userChatlist.map(parseUserSummary);
    if (summaries.some((user) => !user)) throw new ServiceError('UNKNOWN');
    const result = [
      ...summaries.map((user) => directConversation(user!)),
      ...groups.map(groupConversation),
    ];
    // Join existing groups for incoming group events, even before opening a room.
    await Promise.all(groups.map((group) => joinGroup(group._id)));
    assertSessionCurrent(scope);
    for (const conversation of result) {
      conversation.unreadCount = unreadFor(conversation.id);
      const history = queryClient.getQueryData<Message[]>(queryKeys.messages(conversation.id));
      const latest = history?.[history.length - 1];
      if (latest) {
        conversation.lastMessage = {
          text: latest.text || (latest.media?.length ? 'Attachment' : ''),
          senderId: latest.senderId,
          createdAt: latest.createdAt,
        };
        conversation.updatedAt = latest.createdAt;
      }
    }
    // A preview is fetched only when history has actually been loaded; never fabricate one.
    return result;
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
    const { user } = await getData<{ user: UserSummary }>(`/users/${id}`, {
      viewerId: sessionIdentity.userId,
    });
    assertSessionCurrent(scope);
    const safe = parseUserSummary(user);
    if (!safe) throw new ServiceError('UNKNOWN');
    return directConversation(safe);
  },
  listMessages: getHistory,
  async sendMessage(input) {
    const scope = sessionIdentity.generation;
    assertSessionCurrent(scope);
    const [kind, id] = input.conversationId.split(':');
    if (!id || !/^[a-f\d]{24}$/i.test(id) || !['group', 'user'].includes(kind ?? ''))
      throw new ServiceError('NOT_FOUND');
    try {
      const payload = { [kind === 'group' ? 'groupId' : 'receiver']: id, message: input.text };
      let body: FormData | typeof payload = payload;
      if (input.assets?.length) {
        body = new FormData();
        body.append(kind === 'group' ? 'groupId' : 'receiver', id);
        body.append('message', input.text);
        input.assets.forEach((asset) => appendAsset(body as FormData, asset));
      }
      const response = await apiClient.post(
        '/chats/messages',
        body,
        input.assets?.length
          ? { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
          : undefined,
      );
      assertSessionCurrent(scope);
      // clientId is local correlation only. Backend does not implement idempotent retries.
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
    if (key.startsWith('group:')) return; // No group read receipt endpoint exists.
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
};
