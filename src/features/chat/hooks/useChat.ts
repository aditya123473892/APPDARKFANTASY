import { queryClient } from '@/services/queryClient';
import { startSend, resyncSend, sendAgain } from '../services/sendState';
import {
  LOCAL_WINDOW,
  useConversationState,
  roomState,
  updateRoom,
  localWindow,
  captureFirstUnread,
} from '../store/conversationStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useAppState } from '@/hooks/useAppState';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { useChatConnection } from '../services/chatState';
import { useTypingUsers } from '../store/typingStore';
import { userCache } from '@/features/auth/userCache';
import { displayName } from '@/features/auth/userModel';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { queryKeys } from '@/services/queryKeys';
import { chatService } from '../services';
import { useOutbox } from '../store/outboxStore';
import type { Conversation, LocalMessageStatus, Message } from '../types';
import {
  sessionIdentity,
  isSessionCurrent,
  registerSessionTeardown,
} from '@/features/auth/sessionRuntime';
import { INBOX_POLL_MS, pollingEnabled } from '../services/inbox';

/** A message as rendered: either server-confirmed or still in the local outbox. */
export type ChatMessage = Omit<Message, 'status'> & {
  status: LocalMessageStatus;
  local: boolean;
  resync?: 'present' | 'absent';
};

const MESSAGE_POLL_MS = 15_000;

export function useChatVisibility() {
  const [focused, setFocused] = useState(false);
  const state = useAppState();
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return pollingEnabled(focused, state);
}

export function useMyId(): string {
  return useAuthStore((state) => state.currentUser?._id ?? '');
}

export function useConversations(poll = false) {
  const active = useAppState() === 'active';
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => chatService.listConversations(),
    refetchInterval: poll && active ? INBOX_POLL_MS : false,
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
  const visible = useChatVisibility();
  const query = useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: () => chatService.listMessages(conversationId),
    // A live insertion may have created a partial query cache before this screen mounted.
    refetchOnMount: 'always',
    enabled: enabled && Boolean(conversationId),
    // Socket events merge immediately; polling also catches missed server updates.
    refetchInterval: visible ? MESSAGE_POLL_MS : false,
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
        resync: item.resync,
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

  const count = useConversationState(
    (state) => state.rooms[conversationId]?.window ?? LOCAL_WINDOW,
  );
  const loadOlder = useCallback(async () => {
    updateRoom(conversationId, { window: roomState(conversationId).window + LOCAL_WINDOW });
  }, [conversationId]);
  return {
    ...query,
    allMessages: messages,
    messages: localWindow(messages, count),
    hasOlder: messages.length > count,
    loadOlder,
    loadingOlder: false,
    olderError: false,
  };
}

export { createClientId } from '@/utils/clientId';

export function useSendMessage(conversationId: string) {
  const scope = sessionIdentity.generation;
  const send = useCallback(
    (text: string) => {
      if (isSessionCurrent(scope)) startSend(conversationId, text, chatService);
    },
    [conversationId, scope],
  );
  const retry = useCallback((id: string) => {
    void sendAgain(id, chatService).catch(() => undefined);
  }, []);
  const resync = useCallback((id: string) => {
    void resyncSend(id, chatService).catch(() => undefined);
  }, []);
  return { send, retry, resync };
}

/** Names of the people typing in a conversation, excluding the viewer. */
export function useTypingNames(conversationId: string): string[] {
  const ids = useTypingUsers(conversationId);
  const myId = useMyId();
  return useMemo(
    () =>
      ids
        .filter((id) => id !== myId)
        .map((id) => {
          const user = userCache.get(id);
          return user ? displayName(user) : 'Someone';
        }),
    [ids, myId],
  );
}

const TYPING_REFRESH_MS = 3000;

/** Tells the other participants while the viewer is typing; throttled, and stops on send or clear. */
export function useTypingEmitter(conversationId: string) {
  const scope = sessionIdentity.generation;
  const lastSent = useRef(0);
  const stop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopTyping = useCallback(() => {
    clearTimeout(stop.current);
  }, []);
  const onChangeText = useCallback(
    (text: string) => {
      if (!isSessionCurrent(scope)) return;
      if (!conversationId.startsWith('user:') || !text.trim()) return stopTyping();
      const now = Date.now();
      if (now - lastSent.current > TYPING_REFRESH_MS) {
        lastSent.current = now;
        chatService.setTyping(conversationId, true);
      }
      clearTimeout(stop.current);
      stop.current = setTimeout(stopTyping, TYPING_REFRESH_MS + 1000);
    },
    [conversationId, stopTyping, scope],
  );
  useEffect(() => stopTyping, [stopTyping]);
  useEffect(
    () =>
      registerSessionTeardown(() => {
        stopTyping();
        lastSent.current = 0;
      }),
    [stopTyping],
  );
  return { onChangeText, stopTyping };
}

/** Recheck focus/foreground/session at emission, after any queued socket work. */
export function useMarkConversationRead(
  conversationId: string,
  latestIncomingId: string | undefined,
  historyReady = true,
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
      updateRoom(conversationId, { unreadCaptured: false, firstUnread: undefined });
      focus.current = true;
      setFocused(true);
      return () => {
        focus.current = false;
        setFocused(false);
      };
    }, [conversationId]),
  );
  useEffect(() => {
    // Direct read receipts are visible to the sender, so they follow the
    // reciprocal preference. This contract has no group read command.
    const history = queryClient.getQueryData<Message[]>(queryKeys.messages(conversationId));
    if (historyReady && focused && appState === 'active' && history)
      captureFirstUnread(conversationId, history, sessionIdentity.userId ?? '');
    const allowed = () =>
      focus.current &&
      AppState.currentState === 'active' &&
      useChatConnection.getState().ready &&
      isSessionCurrent(scope) &&
      usePreferences.getState().readReceipts &&
      useAuthStore.getState().status === 'authenticated';
    if (
      conversationId.startsWith('user:') &&
      historyReady &&
      latestIncomingId &&
      focused &&
      appState === 'active' &&
      ready &&
      canSend &&
      receipts
    ) {
      void chatService.markRead(conversationId, allowed).catch(() => undefined);
    }
  }, [
    conversationId,
    latestIncomingId,
    historyReady,
    focused,
    appState,
    ready,
    epoch,
    canSend,
    receipts,
    scope,
  ]);
}
