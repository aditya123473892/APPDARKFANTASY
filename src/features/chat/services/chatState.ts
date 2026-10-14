import { create } from 'zustand';
import { sessionIdentity, registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { senderId, userCache } from '@/features/auth/userCache';
import { displayName } from '@/features/auth/userModel';
import { mediaUrl } from '@/services/api/backend';
import type { Conversation, Message } from '../types';
import { conversationKey, mapMessage, parseMessage } from './chatPayload';

export const useChatConnection = create(() => ({ ready: false, epoch: 0 }));
export function setChatReady(ready: boolean): void {
  useChatConnection.setState((state) => ({ ready, epoch: state.epoch + 1 }));
}
const histories = new Set<string>();
const overlays = new Map<string, Map<string, { version: number; message: Message | null }>>();
let version = 0;
let unread = new Map<string, string>();
export const knownHistories = () => [...histories];
export const historyVersion = () => version;
export const unreadFor = (key: string) =>
  [...unread.values()].filter((value) => value === key).length;
export function watchHistory(key: string): void {
  histories.add(key);
}
function sorted(rows: Message[]): Message[] {
  return rows.sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
  );
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
function updatePreview(key: string, rows: Message[]): void {
  const latest = rows[rows.length - 1];
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) =>
      item.id === key
        ? {
            ...item,
            unreadCount: unreadFor(key),
            lastMessage: latest
              ? {
                  text: latest.text || (latest.media?.length ? 'Attachment' : ''),
                  senderId: latest.senderId,
                  createdAt: latest.createdAt,
                }
              : null,
            updatedAt: latest?.createdAt ?? item.createdAt,
          }
        : item,
    ),
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
export function acceptMessage(value: unknown, deleted = false): boolean {
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
/** Changes arriving while a history request is in flight take precedence over that snapshot. */
export function reconcileHistory(key: string, rows: Message[], started: number): Message[] {
  const result = new Map(rows.map((message) => [message.id, preserveRead(message)]));
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
  queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (items) =>
    items?.map((item) => ({ ...item, unreadCount: unreadFor(item.id) })),
  );
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
registerSessionTeardown(() => {
  histories.clear();
  overlays.clear();
  unread.clear();
  version = 0;
  setChatReady(false);
});
