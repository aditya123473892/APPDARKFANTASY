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
  forgetHistory,
  HISTORY_PAGE,
  historyVersion,
  mergeMessage,
  knownHistories,
  reconcileHistory,
  setChatReady,
  useChatConnection,
  watchHistory,
} from './chatState';
import { senderId } from '@/features/auth/userCache';
import { setTyping } from '../store/typingStore';
import { disconnectSending } from '../store/outboxStore';
import { refreshBlockState } from '@/features/safety/blocks';
import { isPeerBlocked, useBlockState } from '@/features/safety/blockState';
import { invalidateSafety, safetyQuery } from '@/features/safety/blockCache';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';

let socket: Socket | undefined;
let socketScope = -1;
let connecting: Promise<Socket> | undefined;
let sync: Promise<void> | undefined;
let connectionEpoch = 0;
let queue: Promise<unknown> = Promise.resolve();
const pending = new Set<() => void>();
const groups = new Set<string>();
/** Conversations whose older cached messages were rechecked on this connection. */
const verified = new Set<string>();
/** Older cached messages rechecked per conversation (the server's limit). */
const VERIFY_LIMIT = 500;
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
  acks = false;
  verified.clear();
  if (clearRooms) groups.clear();
  setChatReady(false);
}
registerSessionTeardown(resetSocket);

type AckReply = { ok: true; data: unknown } | { ok: false; error?: unknown };
const isAckReply = (value: unknown): value is AckReply =>
  Boolean(value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean');
/**
 * Whether this connection's server answers each request in that request's own
 * acknowledgement (`reply: 'ack'`). Learned from the first such answer, since a
 * server deployed before that change ignores the field and replies with events.
 */
let acks = false;

/**
 * A server that answers in acknowledgements correlates every reply, so requests
 * run concurrently and nothing else can fail them. Until that is known, replies
 * are uncorrelated events: requests are serialized, and any `error` event or a
 * timeout ends the request (and a timeout discards the connection).
 */
function requestOn<T>(
  current: Socket,
  scope: number,
  event: string,
  reply?: string,
  payload?: unknown,
  allowed?: () => boolean,
  matches?: (value: T) => boolean,
  /** A 403 here is an expected membership change, not a permission problem. */
  quiet = false,
): Promise<T> {
  const epoch = connectionEpoch;
  const operation = async () => {
    assertSessionCurrent(scope);
    if (current !== socket || !current.connected || epoch !== connectionEpoch)
      throw new ServiceError('NETWORK');
    if (allowed && !allowed()) throw new ServiceError('FORBIDDEN');
    const legacy = !acks;
    // Object (or empty) payloads can carry the flag; joinGroup's bare ID cannot.
    const body =
      payload === undefined || (payload !== null && typeof payload === 'object')
        ? { ...(payload as object | undefined), reply: 'ack' }
        : payload;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        if (reply) current.off(reply, success);
        current.off('error', fail);
        current.off('disconnect', cancel);
        pending.delete(cancel);
      };
      const finish = (data: T) => {
        if (!isSessionCurrent(scope) || current !== socket || epoch !== connectionEpoch)
          reject(new ServiceError('FORBIDDEN'));
        else resolve(data);
      };
      const success = (data: T) => {
        if (settled) return;
        if (matches && !matches(data)) return;
        settled = true;
        cleanup();
        finish(data);
      };
      const acknowledged = (value: unknown) => {
        if (settled) return;
        if (!isAckReply(value)) {
          // A legacy acknowledgement; replies sent as events arrive through `success`.
          if (!reply) success(value as T);
          return;
        }
        if (current === socket && epoch === connectionEpoch) acks = true;
        if (!value.ok) return fail(value.error);
        settled = true;
        cleanup();
        finish(value.data as T);
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
        if (code === 403 && !quiet && isSessionCurrent(scope))
          void notifyForbidden(`Bearer ${sessionIdentity.getToken()}`);
        reject(
          new ServiceError(
            code === 403
              ? 'FORBIDDEN'
              : code === 404
                ? 'NOT_FOUND'
                : typeof code === 'number' && code >= 500
                  ? 'UNKNOWN'
                  : 'VALIDATION',
          ),
        );
      };
      const timer = setTimeout(() => {
        cancel();
        // Uncorrelated replies: discard this connection so a late one cannot
        // satisfy another request. Acknowledged requests just fail.
        if (legacy && current === socket) {
          current.disconnect();
          current.connect();
        }
      }, 15000);
      pending.add(cancel);
      if (legacy) {
        if (reply) current.on(reply, success);
        current.once('error', fail);
      }
      current.once('disconnect', cancel);
      current.emit(event, body, acknowledged);
    });
  };
  if (acks) return operation();
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}
/**
 * The newest page of history, or with `before` the page just older than that
 * message. No request-correlation fields exist; requests are serialized.
 */
async function historyOn(
  current: Socket,
  scope: number,
  key: string,
  quiet = false,
  before?: Message,
): Promise<Message[]> {
  const [kind, id] = key.split(':');
  if (!isObjectId(id) || !kind || !['user', 'group'].includes(kind))
    throw new ServiceError('NOT_FOUND');
  watchHistory(key);
  const started = historyVersion();
  const page = { limit: HISTORY_PAGE, ...(before ? { before: before.id } : {}) };
  const rows = await requestOn<unknown>(
    current,
    scope,
    kind === 'group' ? 'getGroupChatHistory' : 'getChatHistory',
    kind === 'group' ? 'groupChatHistory' : 'chatHistory',
    kind === 'group' ? { groupId: id, ...page } : { user2: id, ...page },
    undefined,
    undefined,
    quiet,
  );
  assertSessionCurrent(scope);
  if (!Array.isArray(rows)) throw new ServiceError('UNKNOWN');
  const parsed = rows.map(parseMessage);
  if (parsed.some((row) => !row || conversationKey(row) !== key)) throw new ServiceError('UNKNOWN');
  const messages = parsed.map((row) => mapMessage(row, key));
  const merged = reconcileHistory(key, messages, started, HISTORY_PAGE, before);
  // Deletions are live events, so only time offline can hide one: recheck the
  // older rows kept beside a full newest page once per connection.
  if (!before && messages.length === HISTORY_PAGE && acks && !verified.has(key)) {
    verified.add(key);
    void dropDeletedOlder(current, scope, key, messages[0]!).catch(() => verified.delete(key));
  }
  return merged;
}
/** Removes cached messages older than `oldest` that no longer exist on the server. */
async function dropDeletedOlder(
  current: Socket,
  scope: number,
  key: string,
  oldest: Message,
): Promise<void> {
  const [kind, id] = key.split(':');
  const rows = (queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [])
    .filter((row) => row.id !== oldest.id && Date.parse(row.createdAt) <= Date.parse(oldest.createdAt))
    .slice(-VERIFY_LIMIT);
  if (!rows.length) return;
  const ids = rows.map((row) => row.id);
  const existing = await requestOn<unknown>(
    current,
    scope,
    'verifyMessages',
    undefined,
    kind === 'group' ? { groupId: id, ids } : { user2: id, ids },
    undefined,
    undefined,
    true,
  );
  assertSessionCurrent(scope);
  if (!Array.isArray(existing)) throw new ServiceError('UNKNOWN');
  const kept = new Set(existing);
  for (const row of rows) if (!kept.has(row.id)) mergeMessage(row, true);
}
/** Access to a conversation ended (e.g. removed from a group while offline). */
const accessLost = (error: unknown) =>
  error instanceof ServiceError && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND');
function forgetGroup(groupId: string): void {
  groups.delete(groupId);
  acceptGroupRemoved({ groupId });
}
async function resync(current: Socket, scope: number, epoch: number): Promise<void> {
  await refreshBlockState();
  // Never await these refetches: an open chat's history query waits for this
  // resync in ensureChatReady, so awaiting it would never finish. Histories
  // are reloaded below instead of refetched.
  void invalidateSafety({ histories: false }).catch(() => undefined);
  // The server already joins every member room on connect; rejoining orders
  // the room subscription before history so no live message is missed.
  for (const groupId of [...groups]) {
    try {
      await requestOn(current, scope, 'joinGroup', undefined, groupId, undefined, undefined, true);
    } catch (error) {
      if (!accessLost(error) || !isSessionCurrent(scope)) throw error;
      forgetGroup(groupId);
    }
  }
  for (const key of knownHistories()) {
    try {
      await historyOn(current, scope, key, true);
    } catch (error) {
      if (!accessLost(error) || !isSessionCurrent(scope)) throw error;
      if (key.startsWith('group:')) forgetGroup(key.slice(6));
      else forgetHistory(key);
    }
  }
  const unread = await requestOn(current, scope, 'getUnreadCount', 'unreadMessageCount');
  assertSessionCurrent(scope);
  if (!acceptUnread(unread)) throw new ServiceError('UNKNOWN');
  if (current !== socket || !current.connected || epoch !== connectionEpoch)
    throw new ServiceError('NETWORK');
  setChatReady(true);
}
/** Failed synchronization is retryable even while the transport stays connected. */
function startResync(current: Socket, scope: number, epoch: number): Promise<void> {
  const task = resync(current, scope, epoch);
  sync = task;
  void task.catch(() => {
    if (current === socket && isSessionCurrent(scope) && epoch === connectionEpoch && sync === task) {
      sync = undefined;
      setChatReady(false);
    }
  });
  return task;
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
    current.on('notificationChanged', (event?: { relationships?: boolean }) => {
      if (!valid()) return;
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (!event?.relationships) return;
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['relationships'] });
      void queryClient.invalidateQueries({ queryKey: ['social-lists'] });
      void queryClient.invalidateQueries({ queryKey: ['social-counts'] });
    });
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
    // Direct `{ sender, isTyping }`; group `{ sender, groupId, isTyping }`.
    // `isTyping: false` clears the indicator; the local TTL covers a lost stop.
    current.on('typing', (raw: unknown) => {
      if (!valid() || !raw || typeof raw !== 'object' || !('sender' in raw)) return;
      const event = raw as { sender: unknown; groupId?: unknown; isTyping?: unknown };
      if (!isObjectId(event.sender) || event.sender === sessionIdentity.userId) return;
      if (isPeerBlocked(event.sender)) return;
      if (event.groupId !== undefined && !isObjectId(event.groupId)) return;
      const key = event.groupId ? `group:${event.groupId}` : `user:${event.sender}`;
      setTyping(key, event.sender, event.isTyping !== false);
    });
    current.on('groupUpdated', (raw: unknown) => {
      if (valid()) acceptGroupUpdated(raw);
    });
    // Removed, left, or deleted: the server has already detached this socket.
    current.on('groupRemoved', (raw: unknown) => {
      if (!valid() || !raw || typeof raw !== 'object' || !('groupId' in raw)) return;
      if (isObjectId(raw.groupId)) forgetGroup(raw.groupId);
    });
    current.on('disconnect', (reason) => {
      if (!valid()) return;
      disconnectSending();
      connectionEpoch++;
      sync = undefined;
      setChatReady(false);
      if (reason === 'io server disconnect') current.connect();
    });
    current.on('visibilityChanged', () => {
      if (!valid()) return;
      useBlockState.setState((state) => ({ version: state.version + 1 }));
      // No peer ID or reason is sent to the other account. Discard all stale
      // social responses and let the server return the same unavailable result.
      void queryClient
        .cancelQueries({ predicate: (query) => safetyQuery(query.queryKey) })
        .then(() => {
          if (!valid()) return;
          return queryClient.resetQueries({ predicate: (query) => safetyQuery(query.queryKey) });
        });
    });
    current.on('connect', () => {
      if (!valid()) return;
      setChatReady(false);
      // A reconnect may reach a server of another version; learn it again.
      acks = false;
      verified.clear();
      const epoch = ++connectionEpoch;
      startResync(current, scope, epoch);
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
/** A stalled resync fails requests instead of leaving them pending forever. */
const SYNC_TIMEOUT_MS = 20_000;
export async function ensureChatReady(): Promise<Socket> {
  const scope = sessionIdentity.generation;
  const current = await connectSocket();
  if (!sync && !useChatConnection.getState().ready) startResync(current, scope, connectionEpoch);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sync,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ServiceError('NETWORK')), SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
  matches?: (value: T) => boolean,
): Promise<T> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return requestOn<T>(current, scope, event, reply, payload, allowed, matches);
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
  quiet = false,
): Promise<T> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return requestOn<T>(current, scope, event, undefined, payload, allowed, undefined, quiet);
}
/**
 * Fire-and-forget typing state; never queued behind history requests and never
 * opens a connection. Group typing is relayed only to rooms this socket is in.
 */
export function emitTyping(
  payload: { receiver: string; isTyping: boolean } | { groupId: string; isTyping: boolean },
): void {
  const id = 'groupId' in payload ? payload.groupId : payload.receiver;
  if (!isObjectId(id) || !socket?.connected || !isSessionCurrent(socketScope)) return;
  if (id === sessionIdentity.userId) return;
  socket.emit('typing', payload);
}
export async function getHistory(key: string): Promise<Message[]> {
  const scope = sessionIdentity.generation;
  if (key.startsWith('group:')) await joinGroup(key.split(':')[1] ?? '');
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  return historyOn(current, scope, key);
}
/** Loads the page of history just older than the oldest cached message. */
export async function getOlderHistory(key: string): Promise<Message[]> {
  const scope = sessionIdentity.generation;
  const current = await ensureChatReady();
  assertSessionCurrent(scope);
  const oldest = queryClient.getQueryData<Message[]>(queryKeys.messages(key))?.[0];
  return historyOn(current, scope, key, false, oldest);
}
