import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';
import {
  sessionIdentity,
  registerSessionTeardown,
  notifyForbidden,
  invalidateSession,
  assertSessionCurrent,
  isSessionCurrent,
} from '@/features/auth/sessionRuntime';
import { ServiceError } from '@/services/errors';
import { initializePinning } from '@/services/api/pinning';
import type { Message } from '../types';
import { conversationKey, isObjectId, mapMessage, parseMessage } from './chatPayload';
import {
  acceptGroupRemoved,
  acceptGroupUpdated,
  acceptMessage,
  acceptUnread,
  acceptRead,
  HISTORY_PAGE,
  historyVersion,
  knownHistories,
  markGroupRead,
  prependHistory,
  reconcileHistory,
  setChatReady,
  useChatConnection,
  watchHistory,
} from './chatState';
import { senderId } from '@/features/auth/userCache';
import { setTyping } from '../store/typingStore';

let socket: Socket | undefined;
let socketScope = -1;
let connecting: Promise<Socket> | undefined;
let sync: Promise<void> | undefined;
let connectionEpoch = 0;
let queue: Promise<unknown> = Promise.resolve();
const pending = new Set<() => void>();
const groups = new Set<string>();
function resetSocket(clearRooms = true): void {
  connectionEpoch++;
  pending.forEach((cancel) => cancel());
  pending.clear();
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = undefined;
  connecting = undefined;
  sync = undefined;
  queue = Promise.resolve();
  if (clearRooms) groups.clear();
  setChatReady(false);
}
registerSessionTeardown(resetSocket);

/** No request IDs exist: serialize event requests, including group acknowledgments. */
function requestOn<T>(
  current: Socket,
  scope: number,
  event: string,
  reply?: string,
  payload?: unknown,
  allowed?: () => boolean,
): Promise<T> {
  const epoch = connectionEpoch;
  const operation = async () => {
    assertSessionCurrent(scope);
    if (current !== socket || !current.connected || epoch !== connectionEpoch)
      throw new ServiceError('NETWORK');
    if (allowed && !allowed()) throw new ServiceError('FORBIDDEN');
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        if (reply) current.off(reply, success);
        current.off('error', fail);
        current.off('disconnect', cancel);
        pending.delete(cancel);
      };
      const success = (data: T) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (!isSessionCurrent(scope) || current !== socket || epoch !== connectionEpoch)
          reject(new ServiceError('FORBIDDEN'));
        else resolve(data);
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new ServiceError('NETWORK'));
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        const code =
          error && typeof error === 'object' && 'statusCode' in error
            ? error.statusCode
            : undefined;
        if (code === 403 && isSessionCurrent(scope))
          void notifyForbidden(`Bearer ${sessionIdentity.getToken()}`);
        reject(
          new ServiceError(code === 403 ? 'FORBIDDEN' : code === 404 ? 'NOT_FOUND' : 'VALIDATION'),
        );
      };
      const timer = setTimeout(() => {
        cancel();
        // Discard this connection so late responses cannot satisfy another request.
        if (current === socket) {
          current.disconnect();
          current.connect();
        }
      }, 15000);
      pending.add(cancel);
      if (reply) current.once(reply, success);
      current.once('error', fail);
      current.once('disconnect', cancel);
      if (reply) current.emit(event, payload);
      else current.emit(event, payload, success);
    });
  };
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}
/** Newest page, or with `before` the page of messages older than that message ID. */
async function historyOn(
  current: Socket,
  scope: number,
  key: string,
  before?: string,
): Promise<Message[]> {
  const [kind, id] = key.split(':');
  if (!isObjectId(id) || !kind || !['user', 'group'].includes(kind))
    throw new ServiceError('NOT_FOUND');
  if (before !== undefined && !isObjectId(before)) throw new ServiceError('VALIDATION');
  watchHistory(key);
  const started = historyVersion();
  const page = { limit: HISTORY_PAGE, ...(before ? { before } : {}) };
  const rows = await requestOn<unknown>(
    current,
    scope,
    kind === 'group' ? 'getGroupChatHistory' : 'getChatHistory',
    kind === 'group' ? 'groupChatHistory' : 'chatHistory',
    kind === 'group' ? { groupId: id, ...page } : { user2: id, ...page },
  );
  assertSessionCurrent(scope);
  if (!Array.isArray(rows)) throw new ServiceError('UNKNOWN');
  const parsed = rows.map(parseMessage);
  if (parsed.some((row) => !row || conversationKey(row) !== key)) throw new ServiceError('UNKNOWN');
  const messages = parsed.map((row) => mapMessage(row, key));
  return before
    ? prependHistory(key, messages, HISTORY_PAGE)
    : reconcileHistory(key, messages, started, HISTORY_PAGE);
}
async function resync(current: Socket, scope: number, epoch: number): Promise<void> {
  for (const groupId of groups) await requestOn(current, scope, 'joinGroup', undefined, groupId);
  for (const key of knownHistories()) await historyOn(current, scope, key);
  const unread = await requestOn(current, scope, 'getUnreadCount', 'unreadMessageCount');
  assertSessionCurrent(scope);
  if (!acceptUnread(unread)) throw new ServiceError('UNKNOWN');
  if (current !== socket || !current.connected || epoch !== connectionEpoch)
    throw new ServiceError('NETWORK');
  setChatReady(true);
}
export async function connectSocket(): Promise<Socket> {
  const scope = sessionIdentity.generation;
  assertSessionCurrent(scope);
  await initializePinning();
  assertSessionCurrent(scope);
  if (socket && socketScope !== scope) resetSocket(false);
  if (connecting) return connecting;
  if (socket?.connected) return socket;
  socketScope = scope;
  socket ??= io(new URL(env.apiUrl).origin, {
    autoConnect: false,
    auth: (callback) =>
      callback(isSessionCurrent(scope) ? { token: sessionIdentity.getToken() } : {}),
    reconnection: true,
    timeout: 10000,
    transports: env.localApiProxy ? ['polling'] : ['websocket'],
  });
  const current = socket;
  const valid = () => isSessionCurrent(scope) && current === socket;
  if (!current.hasListeners('receiveMessage')) {
    // The server subscribes each socket to the rooms of its own groups only.
    const merge = (raw: unknown, deleted = false, received = false) => {
      if (!valid()) return;
      const parsed = parseMessage(raw);
      if (!parsed) return;
      // A delivered message ends that sender's typing indicator.
      if (received) {
        const key = parsed.groupId ? `group:${parsed.groupId}` : `user:${senderId(parsed.sender)}`;
        setTyping(key, senderId(parsed.sender), false);
      }
      acceptMessage(parsed, deleted, received);
    };
    current.on('receiveMessage', (raw: unknown) => merge(raw, false, true));
    current.on('receiveGroupMessage', (raw: unknown) => merge(raw, false, true));
    current.on('messageUpdated', (raw: unknown) => merge(raw));
    current.on('messageDeleted', (raw: unknown) => {
      if (
        !raw ||
        typeof raw !== 'object' ||
        !('messageId' in raw) ||
        !('_id' in raw) ||
        raw.messageId !== raw._id
      )
        return;
      merge(raw, true);
    });
    current.on('unreadData', (raw) => {
      if (valid()) acceptUnread(raw);
    });
    current.on('unreadMessageCount', (raw) => {
      if (valid()) acceptUnread(raw);
    });
    current.on('messagesRead', (raw: unknown) => {
      if (valid() && raw && typeof raw === 'object' && 'userId' in raw && isObjectId(raw.userId))
        acceptRead(raw.userId);
    });
    current.on('typing', (raw: unknown) => {
      if (!valid() || !raw || typeof raw !== 'object' || !('sender' in raw)) return;
      const event = raw as { sender: unknown; groupId?: unknown; isTyping?: unknown };
      if (!isObjectId(event.sender) || event.sender === sessionIdentity.userId) return;
      if (event.groupId !== undefined && !isObjectId(event.groupId)) return;
      const key = event.groupId ? `group:${event.groupId}` : `user:${event.sender}`;
      setTyping(key, event.sender, event.isTyping !== false);
    });
    // Read on another of this user's devices.
    current.on('groupRead', (raw: unknown) => {
      if (valid() && raw && typeof raw === 'object' && 'groupId' in raw && isObjectId(raw.groupId))
        markGroupRead(`group:${raw.groupId}`);
    });
    current.on('groupUpdated', (raw: unknown) => {
      if (valid()) acceptGroupUpdated(raw);
    });
    current.on('groupRemoved', (raw: unknown) => {
      if (!valid()) return;
      if (raw && typeof raw === 'object' && 'groupId' in raw && typeof raw.groupId === 'string')
        groups.delete(raw.groupId);
      acceptGroupRemoved(raw);
    });
    current.on('disconnect', () => {
      if (!valid()) return;
      connectionEpoch++;
      sync = undefined;
      setChatReady(false);
    });
    current.on('connect', () => {
      if (!valid()) return;
      setChatReady(false);
      const epoch = ++connectionEpoch;
      sync = resync(current, scope, epoch);
      void sync.catch(() => {
        if (valid() && epoch === connectionEpoch) setChatReady(false);
      });
    });
    current.on('authError', () => {
      if (valid()) void invalidateSession(`Bearer ${sessionIdentity.getToken()}`);
    });
  }
  connecting = new Promise<Socket>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      current.off('connect', ready);
      current.off('connect_error', fail);
      pending.delete(cancel);
      if (valid()) connecting = undefined;
      if (error) reject(error);
      else if (valid()) resolve(current);
      else reject(new ServiceError('FORBIDDEN'));
    };
    const ready = () => finish();
    const fail = (error: Error) => {
      if (valid() && /Unauthorized/i.test(error.message))
        void invalidateSession(`Bearer ${sessionIdentity.getToken()}`);
      finish(new ServiceError('NETWORK'));
    };
    const cancel = () => finish(new ServiceError('FORBIDDEN'));
    const timer = setTimeout(() => finish(new ServiceError('NETWORK')), 12000);
    pending.add(cancel);
    current.once('connect', ready);
    current.once('connect_error', fail);
    current.connect();
  });
  return connecting;
}
export async function ensureChatReady(): Promise<Socket> {
  const scope = sessionIdentity.generation;
  const current = await connectSocket();
  await sync;
  assertSessionCurrent(scope);
  if (current !== socket || !current.connected || !useChatConnection.getState().ready)
    throw new ServiceError('NETWORK');
  return current;
}
export async function joinGroup(groupId: string): Promise<void> {
  if (!isObjectId(groupId)) throw new ServiceError('NOT_FOUND');
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  if (groups.has(groupId)) return;
  groups.add(groupId);
  try {
    const reply = await requestOn<{ groupId: string }>(
      current,
      scope,
      'joinGroup',
      undefined,
      groupId,
    );
    if (reply?.groupId !== groupId) throw new ServiceError('UNKNOWN');
  } catch (error) {
    if (isSessionCurrent(scope)) groups.delete(groupId);
    throw error;
  }
}
export async function socketRequest<T>(
  event: string,
  reply: string,
  payload?: unknown,
  allowed?: () => boolean,
): Promise<T> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return requestOn<T>(current, scope, event, reply, payload, allowed);
}
export async function refreshUnread(): Promise<void> {
  const scope = sessionIdentity.generation;
  const rows = await socketRequest('getUnreadCount', 'unreadMessageCount');
  assertSessionCurrent(scope);
  if (!acceptUnread(rows)) throw new ServiceError('UNKNOWN');
}
/** Socket.IO acknowledgement request (the handler's return value is the reply). */
export async function socketAck<T>(
  event: string,
  payload?: unknown,
  allowed?: () => boolean,
): Promise<T> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return requestOn<T>(current, scope, event, undefined, payload, allowed);
}
/** Fire-and-forget typing state; never queued behind history requests. */
export function emitTyping(payload: {
  receiver?: string;
  groupId?: string;
  isTyping: boolean;
}): void {
  if (socket?.connected && isSessionCurrent(socketScope)) socket.emit('typing', payload);
}
export async function getOlderHistory(key: string, before: string): Promise<Message[]> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return historyOn(current, scope, key, before);
}
export async function getHistory(key: string): Promise<Message[]> {
  const scope = sessionIdentity.generation;
  if (key.startsWith('group:')) await joinGroup(key.split(':')[1] ?? '');
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return historyOn(current, scope, key);
}
