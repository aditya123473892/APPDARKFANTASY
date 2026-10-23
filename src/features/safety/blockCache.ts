import { queryClient } from '@/services/queryClient';
import { useOutbox } from '@/features/chat/store/outboxStore';
import { userCache } from '@/features/auth/userCache';
import { forgetHistory } from '@/features/chat/services/chatState';
import { assertSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';

export const safetyQuery = (key: readonly unknown[]) =>
  [
    'profiles',
    'feed',
    'chat',
    'events',
    'requests',
    'follow-requests',
    'followers',
    'notifications',
    'user-posts',
    'my-posts',
    'posts',
  ].includes(String(key[0]));
/** Cached group text remains available, but is collapsed and never opens media. */
export function redactCached(value: unknown, peer: string): unknown {
  if (Array.isArray(value))
    return value.map((item) => redactCached(item, peer)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  const row = value as Record<string, unknown>;
  const hasPeerId = (candidate: unknown) =>
    candidate !== null && typeof candidate === 'object' &&
    (('id' in candidate && candidate.id === peer) ||
      ('_id' in candidate && candidate._id === peer));
  if (
    typeof row.conversationId === 'string' &&
    row.conversationId.startsWith('group:') &&
    row.senderId === peer
  )
    return { ...value, blockedSender: true };
  if (
    row.id === `user:${peer}` ||
    row.id === peer ||
    row._id === peer ||
    row.authorId === peer ||
    hasPeerId(row.author) ||
    hasPeerId(row.user) ||
    row.senderId === peer ||
    hasPeerId(row.actor)
  )
    return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactCached(item, peer)]),
  );
}
export async function purgePeer(peer: string) {
  const scope = sessionIdentity.generation;
  await queryClient.cancelQueries({ predicate: (query) => safetyQuery(query.queryKey) });
  assertSessionCurrent(scope);
  const snapshots = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => safetyQuery(query.queryKey) })
    .map((query) => ({ key: query.queryKey, data: query.state.data }));
  for (const item of snapshots) {
    const next = redactCached(item.data, peer);
    if (next === undefined) queryClient.removeQueries({ queryKey: item.key, exact: true });
    else queryClient.setQueryData(item.key, next);
  }
  for (const key of [
    ['chat', 'messages', `user:${peer}`],
    ['chat', 'conversation', `user:${peer}`],
    ['profiles', peer],
    ['user-posts', peer],
  ])
    queryClient.removeQueries({ queryKey: key, exact: true });
  forgetHistory(`user:${peer}`);
  userCache.remove(peer);
  const outbox = useOutbox.getState();
  const pending = Object.values(outbox.items).filter(
    (item) => item.conversationId === `user:${peer}`,
  );
  pending.forEach((item) => outbox.remove(item.clientId));
  return { snapshots, pending };
}
export function invalidateSafety() {
  return queryClient.invalidateQueries({ predicate: (query) => safetyQuery(query.queryKey) });
}
