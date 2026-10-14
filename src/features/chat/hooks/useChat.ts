import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useAppState } from '@/hooks/useAppState';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { hasCapability } from '@/features/auth/permissions';
import { useChatConnection } from '../services/chatState';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { queryKeys } from '@/services/queryKeys';
import { chatService } from '../services';
import { useOutbox, type OutboxItem } from '../store/outboxStore';
import type { Conversation, LocalMessageStatus, Message } from '../types';
import { sessionIdentity, isSessionCurrent } from '@/features/auth/sessionRuntime';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';

/** A message as rendered: either server-confirmed or still in the local outbox. */
export type ChatMessage = Omit<Message, 'status'> & { status: LocalMessageStatus; local: boolean };

const MESSAGE_POLL_MS = 15_000;

export function useMyId(): string {
  return useAuthStore((state) => state.currentUser?._id ?? '');
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => chatService.listConversations(),
    refetchInterval: 30000,
  });
}

/** Total unread across conversations, for the tab badge. */
export function useUnreadMessageCount(): number {
  const { data } = useConversations();
  return useMemo(() => (data ?? []).reduce((sum, item) => sum + item.unreadCount, 0), [data]);
}

export function useConversation(conversationId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.conversation(conversationId),
    queryFn: () => chatService.getConversation(conversationId),
    enabled: Boolean(conversationId),
    // Render the header instantly from the list cache when we came from the chat list.
    placeholderData: () =>
      queryClient
        .getQueryData<Conversation[]>(queryKeys.conversations)
        ?.find((item) => item.id === conversationId),
    retry: false,
  });
}

/** Presence is shown only when the other person shares it and the viewer shares theirs too. */
export function useVisiblePresence(conversation: Conversation | undefined) {
  const showActiveStatus = usePreferences((state) => state.showActiveStatus);
  return showActiveStatus ? (conversation?.presence ?? null) : null;
}

export function useMessages(conversationId: string, enabled = true) {
  const myId = useMyId();
  const readReceipts = usePreferences((state) => state.readReceipts);
  const query = useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: () => chatService.listMessages(conversationId),
    enabled: enabled && Boolean(conversationId),
    // Socket events merge immediately; polling also catches missed server updates.
    refetchInterval: MESSAGE_POLL_MS,
  });
  const outbox = useOutbox(
    useShallow((state) =>
      Object.values(state.items).filter((item) => item.conversationId === conversationId),
    ),
  );

  const messages = useMemo<ChatMessage[]>(() => {
    // Defensive: never render a message that belongs to another conversation.
    const confirmed = (query.data ?? []).filter(
      (message) => message.conversationId === conversationId,
    );
    const confirmedClientIds = new Set(
      confirmed.map((message) => message.clientId).filter(Boolean),
    );
    const pending: ChatMessage[] = outbox
      .filter((item) => !confirmedClientIds.has(item.clientId))
      .map((item) => ({
        id: `local-${item.clientId}`,
        clientId: item.clientId,
        conversationId: item.conversationId,
        senderId: myId,
        text: item.text,
        createdAt: item.createdAt,
        status: item.status,
        local: true,
      }));
    return [
      ...confirmed.map((message) => ({
        ...message,
        // Read receipts are reciprocal: hide "read" when the viewer has them turned off.
        status: !readReceipts && message.status === 'read' ? ('sent' as const) : message.status,
        local: false,
      })),
      ...pending,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [conversationId, myId, outbox, query.data, readReceipts]);

  return { ...query, messages };
}

const createClientId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set<string>());

  const deliver = useCallback(
    async (item: OutboxItem): Promise<void> => {
      // Guard against double taps on "retry" firing the same request twice.
      if (inFlight.current.has(item.clientId)) return;
      inFlight.current.add(item.clientId);
      const outbox = useOutbox.getState();
      const scope = sessionIdentity.generation;
      const auth = useAuthStore.getState();
      if (auth.status !== 'authenticated' || !hasCapability(auth.roles, 'canSendMessages')) {
        inFlight.current.delete(item.clientId);
        toast.error("You don't have permission to send messages.");
        return;
      }
      outbox.setStatus(item.clientId, 'sending');
      try {
        const message = await chatService.sendMessage({
          conversationId: item.conversationId,
          text: item.text,
          clientId: item.clientId,
        });
        if (!isSessionCurrent(scope)) return;
        queryClient.setQueryData<Message[]>(queryKeys.messages(item.conversationId), (current) =>
          !(current ?? []).some((existing) => existing.id === message.id)
            ? [...(current ?? []), message]
            : current,
        );
        useOutbox.getState().remove(item.clientId);
      } catch (error) {
        if (!isSessionCurrent(scope)) return;
        useOutbox.getState().setStatus(item.clientId, 'failed');
        toast.error(
          describeError(
            error,
            'Send status is unknown. Refresh this conversation before sending again.',
          ),
        );
      } finally {
        inFlight.current.delete(item.clientId);
      }
    },
    [queryClient],
  );

  const send = useCallback(
    (text: string): void => {
      const body = text.trim();
      if (!body || !conversationId) return;
      const item: OutboxItem = {
        clientId: createClientId(),
        conversationId,
        text: body,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      useOutbox.getState().upsert(item);
      void deliver(item);
    },
    [conversationId, deliver],
  );

  const retry = useCallback(
    (clientId: string): void => {
      const item = useOutbox.getState().items[clientId];
      if (item && item.conversationId === conversationId) void deliver(item);
    },
    [conversationId, deliver],
  );

  const discard = useCallback((clientId: string) => useOutbox.getState().remove(clientId), []);

  return { send, retry, discard };
}

/** Recheck focus/foreground/session at emission, after any queued socket work. */
export function useMarkConversationRead(
  conversationId: string,
  latestIncomingId: string | undefined,
) {
  const [focused, setFocused] = useState(false);
  const focus = useRef(false);
  const appState = useAppState();
  const ready = useChatConnection((state) => state.ready);
  const epoch = useChatConnection((state) => state.epoch);
  const canSend = useCan('canSendMessages');
  const receipts = usePreferences((state) => state.readReceipts);
  const scope = sessionIdentity.generation;
  useFocusEffect(
    useCallback(() => {
      focus.current = true;
      setFocused(true);
      return () => {
        focus.current = false;
        setFocused(false);
      };
    }, []),
  );
  useEffect(() => {
    const allowed = () =>
      focus.current &&
      AppState.currentState === 'active' &&
      useChatConnection.getState().ready &&
      isSessionCurrent(scope) &&
      usePreferences.getState().readReceipts &&
      useAuthStore.getState().status === 'authenticated';
    if (
      conversationId.startsWith('user:') &&
      latestIncomingId &&
      focused &&
      appState === 'active' &&
      ready &&
      canSend &&
      receipts
    ) {
      void chatService.markRead(conversationId, allowed).catch(() => undefined);
    }
  }, [conversationId, latestIncomingId, focused, appState, ready, epoch, canSend, receipts, scope]);
}
