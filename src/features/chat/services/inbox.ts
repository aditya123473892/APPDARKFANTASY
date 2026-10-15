import type { Conversation, Message } from '../types';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { assertSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';
import { userCache } from '@/features/auth/userCache';
import { displayName } from '@/features/auth/userModel';

// Uncorrelated history replies require one request at a time on this connection.
export const INBOX_PREFETCH_CONCURRENCY = 1;
export const INBOX_POLL_MS = 30_000;
export const LOCAL_SEARCH_LABEL = 'Local search';
export const pollingEnabled = (focused: boolean, state: string) => focused && state === 'active';
let prefetchQueue: Promise<void> = Promise.resolve();

export function messagePreview(message: Message): NonNullable<Conversation['lastMessage']> {
  const attachment = message.media?.[0];
  const user = userCache.get(message.senderId);
  return {
    text:
      message.text ||
      (attachment?.mimetype?.startsWith('image/')
        ? 'Photo'
        : attachment?.mimetype?.startsWith('video/')
          ? 'Video'
          : ''),
    senderId: message.senderId,
    senderName: user ? displayName(user) : message.senderName,
    createdAt: message.createdAt,
    status: message.status,
  };
}
export function localSearch(items: Conversation[], query: string): Conversation[] {
  const needle = query.trim().toLowerCase();
  return items
    .filter(
      (item) =>
        !needle ||
        item.participant.name.toLowerCase().includes(needle) ||
        (queryClient.getQueryData<Message[]>(queryKeys.messages(item.id)) ?? []).some((message) =>
          message.text.toLowerCase().includes(needle),
        ),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || a.id.localeCompare(b.id),
    );
}
/** Lazy, cancellable between requests; loaded empty histories also count as cached. */
export async function prefetchInbox(
  items: Conversation[],
  load: (key: string) => Promise<Message[]>,
  allowed: () => boolean,
  force = false,
): Promise<void> {
  const scope = sessionIdentity.generation;
  const run = async () => {
    let index = 0;
    await Promise.all(
      Array.from({ length: INBOX_PREFETCH_CONCURRENCY }, async () => {
        while (index < items.length && allowed()) {
          assertSessionCurrent(scope);
          const item = items[index++]!;
        if (!force && item.historyLoaded) continue;
          try {
            await load(item.id);
            assertSessionCurrent(scope);
          } catch {
            assertSessionCurrent(scope);
            queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (rows) =>
              rows?.map((row) => (row.id === item.id ? { ...row, previewState: 'error' } : row)),
            );
          }
        }
      }),
    );
  };
  const next = prefetchQueue.then(run, run);
  prefetchQueue = next.catch(() => undefined);
  return next;
}
