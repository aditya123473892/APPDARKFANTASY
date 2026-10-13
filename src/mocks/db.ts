/**
 * In-memory mock backend used by every *.mock service while there is no real API.
 * It mirrors server-side rules (ownership checks, request state transitions, idempotent sends)
 * so the UI exercises realistic flows. State lives for the app session only.
 *
 * Nothing here is used once the real services are swapped in at each feature's services/index.ts.
 */
import type { AppNotification } from '@/features/activity/types';
import type { User } from '@/features/auth/types';
import type { Conversation, Message } from '@/features/chat/types';
import type { Post } from '@/features/feed/types';
import type { ConnectionRequest } from '@/features/requests/types';
import { ServiceError } from '@/services/errors';
import type { Presence, Relationship } from '@/types';
import { MOCK_DELAY_MS } from '@/utils/constants';
import { mockScenes } from './images';
import { currentUser, mockUsers } from './users';

const now = Date.now();
const ago = (ms: number): string => new Date(now - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type DbConversation = { id: string; participantId: string; createdAt: string; unreadCount: number };
type DbRequest = Omit<ConnectionRequest, 'user'> & { userId: string };
type DbNotification = Omit<AppNotification, 'actor'> & { actorId: string };

/** Some people share presence, some don't — a real backend applies their privacy setting. */
const presence: Record<string, Presence | null> = {
  u1: { online: true, lastSeenAt: null },
  u2: { online: false, lastSeenAt: ago(25 * MIN) },
  u3: { online: false, lastSeenAt: ago(5 * HOUR) },
  u4: null,
  u5: { online: true, lastSeenAt: null },
  u6: { online: false, lastSeenAt: ago(2 * DAY) },
};

let me: User = { ...currentUser };
const users = new Map<string, User>(mockUsers.map((user) => [user.id, user]));

const conversations: DbConversation[] = [
  { id: 'c1', participantId: 'u1', createdAt: ago(3 * DAY), unreadCount: 1 },
  { id: 'c2', participantId: 'u2', createdAt: ago(2 * DAY), unreadCount: 2 },
  { id: 'c3', participantId: 'u3', createdAt: ago(6 * DAY), unreadCount: 0 },
  { id: 'c4', participantId: 'u4', createdAt: ago(40 * MIN), unreadCount: 0 },
];

const messages: Message[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    text: 'Your photo from the night market is beautiful.',
    createdAt: ago(DAY + 2 * HOUR),
    status: 'read',
  },
  {
    id: 'm2',
    conversationId: 'c1',
    senderId: 'me',
    text: 'Thank you! It was one of those perfect evenings.',
    createdAt: ago(DAY + HOUR),
    status: 'read',
  },
  {
    id: 'm3',
    conversationId: 'c1',
    senderId: 'u1',
    text: 'There is a tiny café nearby with live jazz on Fridays.',
    createdAt: ago(60 * MIN),
    status: 'read',
  },
  {
    id: 'm4',
    conversationId: 'c1',
    senderId: 'me',
    text: 'That sounds exactly like my kind of place.',
    createdAt: ago(55 * MIN),
    status: 'read',
  },
  {
    id: 'm5',
    conversationId: 'c1',
    senderId: 'u1',
    text: 'Then it is settled. Friday at 8? I will save us the corner table 🎷',
    createdAt: ago(15 * MIN),
    status: 'delivered',
  },
  {
    id: 'm6',
    conversationId: 'c2',
    senderId: 'me',
    text: 'Okay, I need to know — what is the best thing you have ever cooked?',
    createdAt: ago(3 * HOUR),
    status: 'read',
  },
  {
    id: 'm7',
    conversationId: 'c2',
    senderId: 'u2',
    text: 'Honestly? A midnight carbonara for my sister after her finals.',
    createdAt: ago(2 * HOUR),
    status: 'delivered',
  },
  {
    id: 'm8',
    conversationId: 'c2',
    senderId: 'u2',
    text: 'Your playlist is dangerously good ✨',
    createdAt: ago(90 * MIN),
    status: 'delivered',
  },
  {
    id: 'm9',
    conversationId: 'c3',
    senderId: 'u3',
    text: 'Saturday works for me!',
    createdAt: ago(2 * DAY),
    status: 'read',
  },
  {
    id: 'm10',
    conversationId: 'c3',
    senderId: 'me',
    text: 'Perfect. See you at the gallery entrance at 3.',
    createdAt: ago(2 * DAY - 10 * MIN),
    status: 'read',
  },
];

const requests: DbRequest[] = [
  {
    id: 'r1',
    userId: 'u5',
    direction: 'incoming',
    createdAt: ago(35 * MIN),
    superLike: true,
    note: 'Your Lisbon photos made me want to book a train.',
  },
  { id: 'r2', userId: 'u6', direction: 'incoming', createdAt: ago(4 * HOUR), superLike: false },
  { id: 'r3', userId: 'u7', direction: 'outgoing', createdAt: ago(DAY), superLike: false },
];

const posts: Post[] = [
  {
    id: 'post-1',
    user: author(currentUser, true),
    audience: 'everyone',
    body: 'The best dates feel less like an interview and more like finding a new favorite song. #slowdating',
    createdAt: ago(HOUR),
    likes: 148,
    replies: 12,
    liked: false,
  },
  {
    id: 'post-2',
    user: author(mockUsers[0]!, true),
    audience: 'everyone',
    body: 'Found a tiny listening bar with exactly eight seats. Who is coming with me? @nightowls',
    createdAt: ago(2 * HOUR),
    likes: 121,
    replies: 10,
    liked: false,
    media: [
      { uri: mockScenes[0]!, width: 1200, height: 900 },
      { uri: mockScenes[1]!, width: 1200, height: 900 },
    ],
  },
  {
    id: 'post-3',
    user: author(mockUsers[1]!),
    audience: 'everyone',
    body: 'A reminder: chemistry is lovely, but feeling safe enough to be fully yourself is the real spark.',
    createdAt: ago(3 * HOUR),
    likes: 94,
    replies: 8,
    liked: true,
  },
  {
    id: 'post-4',
    user: author(mockUsers[2]!),
    audience: 'everyone',
    body: 'Sunday plan: coffee, a long walk, and nowhere else to be. What does your perfect quiet day look like?',
    createdAt: ago(5 * HOUR),
    likes: 67,
    replies: 6,
    liked: false,
    media: [{ uri: mockScenes[2]!, width: 1200, height: 900 }],
  },
];

const notifications: DbNotification[] = [
  {
    id: 'n1',
    kind: 'request',
    actorId: 'u5',
    text: 'super liked you',
    createdAt: ago(35 * MIN),
    read: false,
  },
  {
    id: 'n2',
    kind: 'connection',
    actorId: 'u4',
    text: 'You are now connected. Say hello!',
    createdAt: ago(40 * MIN),
    read: false,
    conversationId: 'c4',
  },
  {
    id: 'n3',
    kind: 'like',
    actorId: 'u2',
    text: 'liked your post',
    createdAt: ago(HOUR),
    read: false,
    postId: 'post-1',
  },
  {
    id: 'n4',
    kind: 'request',
    actorId: 'u6',
    text: 'wants to connect',
    createdAt: ago(4 * HOUR),
    read: true,
  },
  {
    id: 'n5',
    kind: 'reply',
    actorId: 'u3',
    text: 'replied: “This is exactly it.”',
    createdAt: ago(5 * HOUR),
    read: true,
    postId: 'post-1',
  },
];

function author(user: User, verified = false): Post['user'] {
  return {
    id: user.id,
    name: user.name,
    handle: user.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    avatarUri: user.avatarUri,
    verified,
  };
}

/** Dev-only switch that makes every mock call fail like a dropped connection. */
let offline = false;
export const mockNetwork = {
  isOffline: () => offline,
  setOffline: (value: boolean) => {
    offline = value;
  },
};

export async function respond<T>(produce: () => T, delay = MOCK_DELAY_MS): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (offline) throw new ServiceError('NETWORK', 'Network request failed');
  // Return copies so callers can never mutate "server" state by reference.
  const value = produce();
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

const nextId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function requireUser(id: string): User {
  const user = id === me.id ? me : users.get(id);
  if (!user) throw new ServiceError('NOT_FOUND', 'Profile not found');
  return user;
}

function requireConversation(id: string): DbConversation {
  // Every conversation in this store belongs to the signed-in user; a real API scopes by session.
  const conversation = conversations.find((item) => item.id === id);
  if (!conversation) throw new ServiceError('NOT_FOUND', 'Conversation not found');
  return conversation;
}

function toConversation(row: DbConversation): Conversation {
  const user = requireUser(row.participantId);
  const thread = messages.filter((message) => message.conversationId === row.id);
  const last = thread[thread.length - 1];
  return {
    id: row.id,
    participant: { id: user.id, name: user.name, age: user.age, avatarUri: user.avatarUri },
    lastMessage: last
      ? { text: last.text, senderId: last.senderId, createdAt: last.createdAt }
      : null,
    unreadCount: row.unreadCount,
    presence: presence[user.id] ?? null,
    createdAt: row.createdAt,
    updatedAt: last?.createdAt ?? row.createdAt,
  };
}

function toRequest(row: DbRequest): ConnectionRequest {
  const { userId, ...rest } = row;
  return { ...rest, user: requireUser(userId) };
}

function createConversation(participantId: string): DbConversation {
  const existing = conversations.find((item) => item.participantId === participantId);
  if (existing) return existing;
  const row: DbConversation = {
    id: nextId('c'),
    participantId,
    createdAt: new Date().toISOString(),
    unreadCount: 0,
  };
  conversations.unshift(row);
  return row;
}

export function relationshipWith(userId: string): Relationship {
  const conversation = conversations.find((item) => item.participantId === userId);
  if (conversation) return { status: 'connected', conversationId: conversation.id };
  const request = requests.find((item) => item.userId === userId);
  if (request) return { status: request.direction, requestId: request.id };
  return { status: 'none' };
}

export const db = {
  // Profiles
  me: () => me,
  updateMe: (patch: Partial<User>) => {
    me = { ...me, ...patch };
    posts.forEach((post) => {
      if (post.user.id === me.id) post.user = { ...author(me, post.user.verified) };
    });
    return me;
  },
  user: requireUser,
  discoverable: () => mockUsers.filter((user) => relationshipWith(user.id).status !== 'connected'),
  presenceOf: (userId: string) => presence[userId] ?? null,

  // Conversations & messages
  conversations: () =>
    conversations.map(toConversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  conversation: (id: string) => toConversation(requireConversation(id)),
  messages: (conversationId: string) => {
    requireConversation(conversationId);
    return messages.filter((message) => message.conversationId === conversationId);
  },
  sendMessage: (conversationId: string, text: string, clientId: string): Message => {
    requireConversation(conversationId);
    const body = text.trim();
    if (!body) throw new ServiceError('VALIDATION', 'Message cannot be empty');
    if (body.length > 2000) throw new ServiceError('VALIDATION', 'Message is too long');
    // Idempotency: a retried send with the same clientId returns the original message.
    const duplicate = messages.find(
      (message) => message.clientId === clientId && message.conversationId === conversationId,
    );
    if (duplicate) return duplicate;
    // Only "sent" — delivery and read receipts must come from the recipient's device via a real backend.
    const message: Message = {
      id: nextId('m'),
      clientId,
      conversationId,
      senderId: me.id,
      text: body,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    messages.push(message);
    return message;
  },
  markRead: (conversationId: string) => {
    requireConversation(conversationId).unreadCount = 0;
  },

  // Requests
  requests: () => ({
    incoming: requests.filter((item) => item.direction === 'incoming').map(toRequest),
    outgoing: requests.filter((item) => item.direction === 'outgoing').map(toRequest),
  }),
  sendRequest: (userId: string, superLike: boolean) => {
    requireUser(userId);
    const relationship = relationshipWith(userId);
    if (relationship.status === 'connected')
      return { status: 'connected' as const, conversationId: relationship.conversationId };
    if (relationship.status === 'incoming') {
      return {
        status: 'connected' as const,
        conversationId: db.acceptRequest(relationship.requestId).conversationId,
      };
    }
    if (relationship.status === 'outgoing') {
      return {
        status: 'pending' as const,
        request: toRequest(requests.find((item) => item.id === relationship.requestId)!),
      };
    }
    const row: DbRequest = {
      id: nextId('r'),
      userId,
      direction: 'outgoing',
      createdAt: new Date().toISOString(),
      superLike,
    };
    requests.unshift(row);
    return { status: 'pending' as const, request: toRequest(row) };
  },
  acceptRequest: (requestId: string) => {
    const index = requests.findIndex(
      (item) => item.id === requestId && item.direction === 'incoming',
    );
    if (index < 0) throw new ServiceError('NOT_FOUND', 'This request is no longer available');
    const [row] = requests.splice(index, 1);
    const conversation = createConversation(row!.userId);
    notifications.unshift({
      id: nextId('n'),
      kind: 'connection',
      actorId: row!.userId,
      text: 'You are now connected. Say hello!',
      createdAt: new Date().toISOString(),
      read: true,
      conversationId: conversation.id,
    });
    return { conversationId: conversation.id };
  },
  removeRequest: (requestId: string, direction: 'incoming' | 'outgoing') => {
    const index = requests.findIndex(
      (item) => item.id === requestId && item.direction === direction,
    );
    if (index < 0) throw new ServiceError('NOT_FOUND', 'This request is no longer available');
    requests.splice(index, 1);
  },

  // Feed
  posts: () =>
    posts.filter(
      (post) =>
        post.audience === 'everyone' ||
        post.user.id === me.id ||
        relationshipWith(post.user.id).status === 'connected',
    ),
  createPost: (body: string, audience: Post['audience']): Post => {
    const text = body.trim();
    if (!text) throw new ServiceError('VALIDATION', 'Write something before posting');
    if (text.length > 500)
      throw new ServiceError('VALIDATION', 'Posts can be up to 500 characters');
    const post: Post = {
      id: nextId('post'),
      user: author(me),
      body: text,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: 0,
      liked: false,
      audience,
    };
    posts.unshift(post);
    return post;
  },
  setLiked: (postId: string, liked: boolean): Post => {
    const post = posts.find((item) => item.id === postId);
    if (!post) throw new ServiceError('NOT_FOUND', 'Post not found');
    if (post.liked !== liked) {
      post.liked = liked;
      post.likes += liked ? 1 : -1;
    }
    return post;
  },

  // Notifications
  notifications: (): AppNotification[] =>
    notifications
      .filter((item) => users.has(item.actorId))
      .map(({ actorId, ...rest }) => {
        const actor = requireUser(actorId);
        return { ...rest, actor: { id: actor.id, name: actor.name, avatarUri: actor.avatarUri } };
      }),
  markNotificationsRead: (ids?: string[]) => {
    notifications.forEach((item) => {
      if (!ids || ids.includes(item.id)) item.read = true;
    });
  },
};
