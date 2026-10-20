import { messagePreview } from './inbox';
import { isPeerBlocked } from '@/features/safety/blockState';
import { useOutbox } from '../store/outboxStore';
import { create } from 'zustand';
import { sessionIdentity, registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { senderId, userCache } from '@/features/auth/userCache';
import { displayName } from '@/features/auth/userModel';
import { mediaUrl } from '@/services/api/backend';
import type { Conversation, Message } from '../types';
import { conversationKey, isObjectId, mapMessage, parseMessage } from './chatPayload';

export const useChatConnection = create(() => ({ ready: false, epoch: 0 }));
export function setChatReady(ready: boolean): void {
  useChatConnection.setState((state) => ({ ready, epoch: state.epoch + 1 }));
}
const histories = new Set<string>();
const overlays = new Map<string, Map<string, { version: number; message: Message | null }>>();
let version = 0;
/** Unread direct messages by message ID, from the server's unread arrays and live events. */
let unread = new Map<string, string>();
export const knownHistories = () => [...histories];
export const historyVersion = () => version;
export function unreadFor(key: string): number {
  if (key.startsWith('group:')) return 0;
  return [...unread.values()].filter((value) => value === key).length;
}
export function watchHistory(key: string): void {
  histories.add(key);
}
/** Stop resyncing a conversation the viewer can no longer read. */
export function forgetHistory(key: string): void {
  histories.delete(key);
  overlays.delete(key);
}
const compareMessages = (a: Message, b: Message) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id);
function sorted(rows: Message[]): Message[] {
  return rows.sort(compareMessages);
}
function preserveRead(message: Message): Message {
  const previous = queryClient
    .getQueryData<Message[]>(queryKeys.messages(message.conversationId))
    ?.find((row) => row.id === message.id);
  return {
    ...message,
    clientId: message.clientId ?? previous?.clientId,
    // Delayed history/socket responses cannot make a consumed photo look unopened.
    viewedAt: message.viewedAt ?? previous?.viewedAt,
    status: previous?.status === 'read' ? 'read' : message.status,
  };
}
function refreshUnreadCounts(): void {
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) => ({ ...item, unreadCount: unreadFor(item.id) })),
  );
}
function updatePreview(key: string, rows: Message[], complete = false): void {
  const latest = rows[rows.length - 1];
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) => {
      if (item.id !== key) return item;
      return {
        ...item,
        previewState: 'loaded',
        historyLoaded: complete || item.historyLoaded,
        unreadCount: unreadFor(key),
        lastMessage: latest ? messagePreview(latest) : null,
        updatedAt: latest?.createdAt ?? item.createdAt,
      };
    }),
  );
}
/** REST responses and socket messages use the same server-ID merge. */
export function mergeMessage(message: Message, deleted = false): void {
  const key = message.conversationId;
  if (key.startsWith('user:') && isPeerBlocked(key.slice(5))) return;
  const next = preserveRead(message);
  if (!deleted && message.senderId === sessionIdentity.userId) {
    const state = useOutbox.getState();
    // The server echoes the idempotency key, so the socket echo of a send can
    // settle its outbox entry even if the HTTP response never arrives.
    const sent = message.clientId ? state.items[message.clientId] : undefined;
    if (sent?.conversationId === key) state.remove(sent.clientId);
    for (const item of Object.values(state.items))
      if (item.conversationId === key && item.status === 'uncertain' && item.text === message.text)
        state.setResync(item.clientId, undefined);
  }
  const journal = overlays.get(key) ?? new Map();
  journal.set(message.id, { version: ++version, message: deleted ? null : next });
  overlays.set(key, journal);
  if (deleted) unread.delete(message.id);
  queryClient.setQueryData<Message[]>(queryKeys.messages(key), (current) => {
    const previous = current?.find((row) => row.id === message.id);
    const merged =
      previous && previous.status === 'read' ? { ...next, status: 'read' as const } : next;
    const rows = sorted([
      ...(current ?? []).filter((row) => row.id !== message.id),
      ...(deleted ? [] : [{ ...merged, clientId: merged.clientId ?? previous?.clientId }]),
    ]);
    return rows;
  });
  updatePreview(key, queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? []);
}
export const isExpired = (message: Pick<Message, 'expiresAt'>, now = Date.now()) =>
  Boolean(message.expiresAt) && Date.parse(message.expiresAt!) <= now;

/** Remove expired server messages while preserving the local history/preview merge. */
export function purgeExpiredMessages(key: string, now = Date.now()): number | null {
  const rows = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
  let next: number | null = null;
  for (const message of rows) {
    if (!message.expiresAt) continue;
    if (isExpired(message, now)) mergeMessage(message, true);
    else next = Math.min(next ?? Infinity, Date.parse(message.expiresAt));
  }
  return next;
}
/**
 * Applies a server message event. `received` marks a newly delivered message
 * (receiveMessage/receiveGroupMessage) as opposed to an edit or deletion.
 */
export function acceptMessage(value: unknown, deleted = false, _received = false): boolean {
  const raw = parseMessage(value);
  if (!raw) return false;
  const key = conversationKey(raw);
  if (!key) return false;
  if (key.startsWith('user:') && isPeerBlocked(key.slice(5))) return false;
  const previous = queryClient
    .getQueryData<Message[]>(queryKeys.messages(key))
    ?.find((message) => message.id === raw._id);
  if (
    !deleted &&
    raw.receiver &&
    senderId(raw.receiver) === sessionIdentity.userId &&
    !raw.isRead &&
    previous?.status !== 'read'
  )
    unread.set(raw._id, key);
  const message = mapMessage(raw, key);
  if (!raw.groupId && !deleted) {
    const peerId = key.slice(5);
    const peer = userCache.get(peerId);
    queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) => {
      if (items?.some((item) => item.id === key)) return items;
      return [
        ...(items ?? []),
        {
          id: key,
          kind: 'direct',
          participant: {
            id: peerId,
            name: peer ? displayName(peer) : 'Conversation',
            avatarUri: mediaUrl(peer?.avatar),
            age: 0,
          },
          lastMessage: null,
          unreadCount: unreadFor(key),
          presence: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
    });
  }
  mergeMessage(message, deleted);
  return true;
}
/** Full-history snapshot; realtime edits/deletions received during loading win. */
export function reconcileHistory(key: string, rows: Message[], started: number): Message[] {
  if (key.startsWith('user:') && isPeerBlocked(key.slice(5))) return [];
  const result = new Map(rows.map((message) => [message.id, preserveRead(message)]));
  for (const [id, entry] of overlays.get(key) ?? []) {
    if (entry.version <= started) continue;
    if (entry.message) result.set(id, preserveRead(entry.message));
    else result.delete(id);
  }
  const merged = sorted([...result.values()]);
  queryClient.setQueryData(queryKeys.messages(key), merged);
  updatePreview(key, merged, true);
  // Only prune entries represented by the snapshot; another request may still be in flight.
  return merged;
}
export function acceptUnread(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const next = new Map<string, string>();
  for (const item of value) {
    const raw = parseMessage(item);
    if (
      !raw ||
      raw.groupId ||
      !raw.receiver ||
      senderId(raw.receiver) !== sessionIdentity.userId ||
      raw.isRead
    )
      return false;
    const key = conversationKey(raw);
    if (key) next.set(raw._id, key);
  }
  unread = next;
  refreshUnreadCounts();
  return true;
}
export function acceptRead(userId: string): void {
  const key = `user:${userId}`;
  // This event covers messages saved before it arrived, not future messages.
  const rows = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
  for (const message of rows)
    if (message.senderId === sessionIdentity.userId) mergeMessage({ ...message, status: 'read' });
}
export function markPeerRead(key: string): void {
  queryClient.setQueryData<Message[]>(queryKeys.messages(key), (rows) =>
    rows?.map((message) =>
      message.senderId !== sessionIdentity.userId ? { ...message, status: 'read' } : message,
    ),
  );
}
/** Group metadata or membership changed: refresh the inbox and that group's details. */
export function acceptGroupUpdated(value: unknown): void {
  const groupId =
    value && typeof value === 'object' && '_id' in value ? (value as { _id: unknown })._id : null;
  if (!isObjectId(groupId)) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
  void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(`group:${groupId}`) });
}
/** The viewer left, was removed, or the group was deleted. */
export function acceptGroupRemoved(value: unknown): void {
  const groupId =
    value && typeof value === 'object' && 'groupId' in value
      ? (value as { groupId: unknown }).groupId
      : null;
  if (!isObjectId(groupId)) return;
  const key = `group:${groupId}`;
  forgetHistory(key);
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.filter((item) => item.id !== key),
  );
  queryClient.removeQueries({ queryKey: queryKeys.messages(key) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(key) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
}
registerSessionTeardown(() => {
  histories.clear();
  overlays.clear();
  unread.clear();
  version = 0;
  queryClient.removeQueries({ queryKey: ['chat'] });
  setChatReady(false);
});
