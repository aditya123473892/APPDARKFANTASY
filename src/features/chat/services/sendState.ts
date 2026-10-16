import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { ServiceError } from '@/services/errors';
import {
  sessionIdentity,
  isSessionCurrent,
  registerSessionTeardown,
} from '@/features/auth/sessionRuntime';
import { useOutbox, type OutboxItem } from '../store/outboxStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { hasCapability } from '@/features/auth/permissions';
import { createClientId } from '@/utils/clientId';
import { mergeMessage } from './chatState';
import type { ChatService } from './chatService';
import type { Message } from '../types';

const inFlight = new Set<string>();
const allowed = () => {
  const auth = useAuthStore.getState();
  return auth.status === 'authenticated' && hasCapability(auth.roles, 'canSendMessages');
};
export function failureState(error: unknown): 'failed-definitive' | 'uncertain' {
  return error instanceof ServiceError &&
    ['FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'CONFLICT'].includes(error.code)
    ? 'failed-definitive'
    : 'uncertain';
}
export function retryAvailable(item: OutboxItem): boolean {
  return (
    item.status === 'failed-definitive' || (item.status === 'uncertain' && item.resync === 'absent')
  );
}
export async function deliver(item: OutboxItem, service: ChatService): Promise<void> {
  if (inFlight.has(item.clientId) || !allowed()) return;
  inFlight.add(item.clientId);
  const scope = sessionIdentity.generation;
  useOutbox.getState().setStatus(item.clientId, 'sending');
  try {
    const message = await service.sendMessage(item);
    if (!isSessionCurrent(scope)) return;
    mergeMessage(message);
    useOutbox.getState().remove(item.clientId);
  } catch (error) {
    if (isSessionCurrent(scope)) useOutbox.getState().setStatus(item.clientId, failureState(error));
  } finally {
    inFlight.delete(item.clientId);
  }
}
export function startSend(
  key: string,
  text: string,
  service: ChatService,
  ttlSeconds?: number | null,
): void {
  if (!text.trim() || !allowed()) return;
  const baseline = queryClient.getQueryData<Message[]>(queryKeys.messages(key)) ?? [];
  const item: OutboxItem = {
    clientId: createClientId(),
    conversationId: key,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    status: 'sending',
    baselineIds: baseline.map((row) => row.id),
    ...(ttlSeconds ? { ttlSeconds } : {}),
  };
  useOutbox.getState().upsert(item);
  void deliver(item, service);
}
/** Never sends. Matching content is deliberately conservative without server correlation. */
export async function resyncSend(clientId: string, service: ChatService): Promise<void> {
  const item = useOutbox.getState().items[clientId];
  if (!item || item.status !== 'uncertain' || inFlight.has(clientId)) return;
  const scope = sessionIdentity.generation;
  inFlight.add(clientId);
  useOutbox.getState().setResync(clientId, undefined);
  try {
    const rows = await service.listMessages(item.conversationId);
    if (!isSessionCurrent(scope)) return;
    const match = rows.some(
      (row) =>
        row.senderId === sessionIdentity.userId &&
        row.text === item.text &&
        !(item.baselineIds ?? []).includes(row.id),
    );
    useOutbox.getState().setResync(clientId, match ? 'present' : 'absent');
  } finally {
    inFlight.delete(clientId);
  }
}
/** Called only after explicit user confirmation; rechecks history immediately before sending. */
export async function sendAgain(clientId: string, service: ChatService): Promise<void> {
  let item = useOutbox.getState().items[clientId];
  if (!item || !retryAvailable(item) || !allowed() || inFlight.has(clientId)) return;
  const scope = sessionIdentity.generation;
  if (item.status === 'uncertain') {
    await resyncSend(clientId, service);
    if (!isSessionCurrent(scope)) return;
    item = useOutbox.getState().items[clientId];
    if (!item || item.resync !== 'absent') return;
  }
  await deliver(item, service);
}
registerSessionTeardown(() => {
  inFlight.clear();
  useOutbox.getState().clear();
});
