import { create } from 'zustand';
import { sessionIdentity, registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { senderId, userCache } from '@/features/auth/userCache';
import { displayName } from '@/features/auth/userModel';
import { mediaUrl } from '@/services/api/backend';
import type { Conversation, Message } from '../types';
import { conversationKey, isObjectId, mapMessage, parseMessage, previewText } from './chatPayload';

/** Messages per history request; fewer rows than this means the start of the conversation. */
export const HISTORY_PAGE = 50;

export const useChatConnection = create(() => ({ ready: false, epoch: 0 }));
export function setChatReady(ready: boolean): void {
  useChatConnection.setState((state) => ({ ready, epoch: state.epoch + 1 }));
}
const histories = new Set<string>();
const overlays = new Map<string, Map<string, { version: number; message: Message | null }>>();
let version = 0;
/** Unread direct messages by message ID, from the server's unread arrays and live events. */
let unread = new Map<string, string>();
/** Server-reported direct counts, used only while the realtime unread list is unavailable. */
let directFallback: Map<string, number> | null = null;
/** Group unread counts (server cursor based), advanced by live group messages. */
const groupUnread = new Map<string, number>();
const countedGroupMessages = new Set<string>();
/** Whether messages older than the oldest loaded one may exist, per conversation. */
const olderAvailable = new Map<string, boolean>();

export const knownHistories = () => [...histories];
export const historyVersion = () => version;
export const hasOlderHistory = (key: string) => olderAvailable.get(key) ?? false;
export function unreadFor(key: string): number {
  if (key.startsWith('group:')) return groupUnread.get(key) ?? 0;
  if (directFallback) return directFallback.get(key) ?? 0;
  return [...unread.values()].filter((value) => value === key).length;
}
export function watchHistory(key: string): void {
  histories.add(key);
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
    status: previous?.status === 'read' ? 'read' : message.status,
  };
}
function refreshUnreadCounts(): void {
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) => ({ ...item, unreadCount: unreadFor(item.id) })),
  );
}
function updatePreview(key: string, rows: Message[]): void {
  const latest = rows[rows.length - 1];
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) => {
      if (item.id !== key) return item;
      // A history page may end before the server-reported preview; keep the newer one.
      const keepCurrent =
        item.lastMessage &&
        (!latest || Date.parse(item.lastMessage.createdAt) > Date.parse(latest.createdAt));
      return {
        ...item,
        unreadCount: unreadFor(key),
        lastMessage: keepCurrent
          ? item.lastMessage
          : latest
            ? {
                text: previewText(latest),
                senderId: latest.senderId,
                createdAt: latest.createdAt,
              }
            : null,
        updatedAt: keepCurrent ? item.updatedAt : (latest?.createdAt ?? item.createdAt),
      };
    }),
  );
}
/** REST responses and socket messages use the same server-ID merge. */
export function mergeMessage(message: Message, deleted = false): void {
  const key = message.conversationId;
  const next = preserveRead(message);
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
/**
 * Removes disappearing messages whose timer has run out from a loaded
 * conversation. The server already stops returning them; this keeps the
 * device from showing them until the next refetch. Returns the next expiry.
 */
export function purgeExpiredMessages(key: string, now = Date.now()): number | null {
  const rows = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
  let next: number | null = null;
  const removed = new Set<string>();
  for (const message of rows) {
    if (!message.expiresAt) continue;
    if (isExpired(message, now)) {
      mergeMessage(message, true);
      removed.add(message.createdAt);
    } else next = Math.min(next ?? Infinity, Date.parse(message.expiresAt));
  }
  if (removed.size) {
    // updatePreview keeps a newer server preview; an expired one must go.
    const remaining = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
    const latest = remaining[remaining.length - 1];
    queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
      items?.map((item) =>
        item.id === key && item.lastMessage && removed.has(item.lastMessage.createdAt)
          ? {
              ...item,
              lastMessage: latest
                ? {
                    text: previewText(latest),
                    senderId: latest.senderId,
                    createdAt: latest.createdAt,
                  }
                : null,
            }
          : item,
      ),
    );
  }
  return next;
}
/**
 * Applies a server message event. `received` marks a newly delivered message
 * (receiveMessage/receiveGroupMessage) as opposed to an edit or deletion.
 */
export function acceptMessage(value: unknown, deleted = false, received = false): boolean {
  const raw = parseMessage(value);
  if (!raw) return false;
  const key = conversationKey(raw);
  if (!key) return false;
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
  if (
    received &&
    !deleted &&
    raw.groupId &&
    !previous &&
    senderId(raw.sender) !== sessionIdentity.userId &&
    !countedGroupMessages.has(raw._id)
  ) {
    countedGroupMessages.add(raw._id);
    groupUnread.set(key, (groupUnread.get(key) ?? 0) + 1);
  }
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
/**
 * Merges the newest page of a conversation. Changes that arrived while the
 * request was in flight take precedence over the snapshot. Older pages loaded
 * earlier are kept when the snapshot is a full page (so it cannot cover them).
 */
export function reconcileHistory(
  key: string,
  rows: Message[],
  started: number,
  pageLimit?: number,
): Message[] {
  const result = new Map(rows.map((message) => [message.id, preserveRead(message)]));
  const fullPage = pageLimit !== undefined && rows.length >= pageLimit;
  let keptOlder = false;
  if (fullPage) {
    const oldest = sorted([...rows])[0]!;
    for (const row of queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? []) {
      if (!result.has(row.id) && compareMessages(row, oldest) < 0) {
        result.set(row.id, row);
        keptOlder = true;
      }
    }
  }
  if (pageLimit !== undefined)
    olderAvailable.set(key, keptOlder ? (olderAvailable.get(key) ?? true) : fullPage);
  for (const [id, entry] of overlays.get(key) ?? []) {
    if (entry.version <= started) continue;
    if (entry.message) result.set(id, preserveRead(entry.message));
    else result.delete(id);
  }
  const merged = sorted([...result.values()]);
  queryClient.setQueryData(queryKeys.messages(key), merged);
  updatePreview(key, merged);
  // Only prune entries represented by the snapshot; another request may still be in flight.
  return merged;
}
/** Adds an older page in front of the loaded history. */
export function prependHistory(key: string, rows: Message[], pageLimit: number): Message[] {
  const journal = overlays.get(key);
  const current = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
  const result = new Map(current.map((message) => [message.id, message]));
  for (const row of rows) {
    if (result.has(row.id)) continue;
    const overlay = journal?.get(row.id);
    if (overlay && !overlay.message) continue; // deleted while the page was loading
    result.set(row.id, preserveRead(overlay?.message ?? row));
  }
  olderAvailable.set(key, rows.length >= pageLimit);
  const merged = sorted([...result.values()]);
  queryClient.setQueryData(queryKeys.messages(key), merged);
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
  directFallback = null;
  refreshUnreadCounts();
  return true;
}
/** Server counts from the conversation list, used until a realtime unread list arrives. */
export function acceptServerUnread(
  direct: Map<string, number> | null,
  groups: Map<string, number>,
): void {
  if (direct) directFallback = direct;
  for (const [key, count] of groups) groupUnread.set(key, count);
  refreshUnreadCounts();
}
export function markGroupRead(key: string): void {
  groupUnread.set(key, 0);
  refreshUnreadCounts();
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
  histories.delete(key);
  overlays.delete(key);
  groupUnread.delete(key);
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
  directFallback = null;
  groupUnread.clear();
  countedGroupMessages.clear();
  olderAvailable.clear();
  version = 0;
  setChatReady(false);
});
