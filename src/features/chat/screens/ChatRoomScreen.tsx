import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { KeyboardAvoidingScreen, useSafeBack } from '@/components/layout';
import { Avatar, EmptyState, Loader, Skeleton, Text } from '@/components/ui';
import { useKeyboard } from '@/hooks/useKeyboard';
import { isServiceError, describeError } from '@/services/errors';
import { radius, spacing, typography } from '@/theme';
import { TypingDots } from '../components/TypingDots';
import { useTheme } from '@/theme/useTheme';
import * as Clipboard from 'expo-clipboard';
import { messageActions } from '../utils/messageActions';
import { roomState, updateRoom, useConversationState } from '../store/conversationStore';
import type { ChatMessage } from '../hooks/useChat';
import { ChatInput } from '../components/ChatInput';
import { DateDivider } from '../components/DateDivider';
import { useMutation } from '@tanstack/react-query';
import { pickMedia } from '@/features/create-post/pickMedia';
import { chatService } from '../services';
import { toast } from '@/components/ui/Toast';
import {
  sessionIdentity,
  isSessionCurrent,
  registerSessionTeardown,
} from '@/features/auth/sessionRuntime';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { useAuthStore } from '@/features/auth/store/authStore';
import { hasCapability } from '@/features/auth/permissions';
import { MessageBubble } from '../components/MessageBubble';
import {
  createClientId,
  useConversation,
  useMarkConversationRead,
  useMessages,
  useMyId,
  useSendMessage,
  useTypingEmitter,
  useTypingNames,
} from '../hooks/useChat';
import { buildRows, type ChatRow as Row } from '../utils/buildRows';
import { TimerSheet } from '../components/TimerSheet';
import { timerShortLabel } from '../disappearing';
import { featureFlags } from '@/config/featureFlags';

function chooseViewOnce(type?: string | null): Promise<boolean | null> {
  const kind = type?.startsWith('video/') ? 'video' : 'photo';
  return new Promise((resolve) =>
    Alert.alert(
      `Send ${kind}`,
      `A view-once ${kind} can be opened a single time by the recipient. They may still capture it with another device.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'View once', onPress: () => resolve(true) },
        { text: 'Send', onPress: () => resolve(false) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}

function MessagesSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeleton}>
      {[0.55, 0.4, 0.68, 0.35, 0.5].map((width, index) => (
        <Skeleton
          key={index}
          style={[
            styles.skeletonBubble,
            { width: `${width * 100}%` },
            index % 2 ? styles.skeletonMine : null,
          ]}
        />
      ))}
    </View>
  );
}

export function ChatRoomScreen(): React.JSX.Element {
  const renderScope = sessionIdentity.generation;
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const goBack = useSafeBack('/chats');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboard();
  const myId = useMyId();
  const canSendMessages = useCan('canSendMessages');
  const canShareMedia = useCan('canShareMedia');
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [timerSheet, setTimerSheet] = useState(false);
  const attach = useMutation({
    mutationFn: async () => {
      const scope = renderScope;
      const allowed = () => {
        const auth = useAuthStore.getState();
        return (
          isSessionCurrent(scope) &&
          auth.status === 'authenticated' &&
          hasCapability(auth.roles, 'canShareMedia')
        );
      };
      if (!allowed()) return;
      const assets = await pickMedia();
      if (!assets.length || !allowed()) return;
      const viewOnce =
        featureFlags.ENABLE_EPHEMERAL_CHAT &&
        conversationId.startsWith('user:') &&
        assets.length === 1
          ? await chooseViewOnce(assets[0]?.type)
          : false;
      if (viewOnce === null || !allowed()) return;
      try {
        await chatService.sendMessage({
          conversationId,
          text: '',
          assets,
          clientId: createClientId(),
          ...(ttlSeconds ? { ttlSeconds } : {}),
          ...(viewOnce ? { viewOnce: true } : {}),
        });
      } catch (error) {
        if (isSessionCurrent(scope))
          toast.error(
            describeError(
              error,
              'Attachment send status is unknown. Refresh before sending again.',
            ),
          );
      }
    },
  });
  const listRef = useRef<FlashListRef<Row>>(null);
  const [showJump, setShowJump] = useState(false);

  const conversationQuery = useConversation(conversationId);
  const conversation = conversationQuery.data;
  const notFound = !conversationId || isServiceError(conversationQuery.error, 'NOT_FOUND');
  const messagesQuery = useMessages(conversationId, !notFound);
  const { messages, allMessages } = messagesQuery;
  const { send, retry, resync } = useSendMessage(conversationId);
  const typing = useTypingEmitter(conversationId);
  const typingNames = useTypingNames(conversationId);
  const isGroup = conversation?.kind === 'group' || conversationId.startsWith('group:');
  const typingLabel =
    !isGroup && typingNames.length
      ? isGroup
        ? typingNames.length === 1
          ? `${typingNames[0]} is typing…`
          : `${typingNames.length} people are typing…`
        : 'typing…'
      : null;

  const subtitle =
    typingLabel ??
    (isGroup && conversation?.memberCount ? `${conversation.memberCount} members` : null);

  const latestIncomingId = useMemo(
    () =>
      [...allMessages].reverse().find((message) => !message.local && message.senderId !== myId)?.id,
    [allMessages, myId],
  );
  useMarkConversationRead(
    conversation ? conversationId : '',
    latestIncomingId,
    !messagesQuery.isFetching && messagesQuery.isSuccess,
  );

  const rows = useMemo(() => buildRows(messages), [messages]);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onSend = useCallback(
    (text: string) => {
      typing.stopTyping();
      send(text, ttlSeconds);
      requestAnimationFrame(scrollToLatest);
    },
    [scrollToLatest, send, ttlSeconds, typing],
  );
  const { hasOlder, loadOlder, loadingOlder, olderError } = messagesQuery;
  const onEndReached = useCallback(() => {
    // Inverted list: the end is the top, i.e. the oldest loaded message.
    if (hasOlder && !olderError) void loadOlder();
  }, [hasOlder, loadOlder, olderError]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted list: offset 0 is the newest message at the bottom.
    setShowJump(event.nativeEvent.contentOffset.y > 480);
  }, []);

  const draft = useConversationState((state) => state.rooms[conversationId]?.draft ?? '');
  const firstUnread = useConversationState((state) => state.rooms[conversationId]?.firstUnread);
  const [editing, setEditing] = useState<ChatMessage>();
  const [editText, setEditText] = useState('');
  useEffect(
    () =>
      registerSessionTeardown(() => {
        setEditing(undefined);
        setEditText('');
      }),
    [],
  );
  const openActions = useCallback(
    (message: ChatMessage) => {
      const scope = renderScope;
      const valid = () => isSessionCurrent(scope);
      const options = messageActions(message, myId);
      Alert.alert('Message', undefined, [
        ...(options.includes('copy')
          ? [
              {
                text: 'Copy',
                onPress: () => {
                  if (valid())
                    void Clipboard.setStringAsync(message.text).catch(() =>
                      toast.error('Could not copy text.'),
                    );
                },
              },
            ]
          : []),
        ...(canSendMessages && options.includes('edit')
          ? [
              {
                text: 'Edit',
                onPress: () => {
                  if (valid()) {
                    setEditing(message);
                    setEditText(message.text);
                  }
                },
              },
            ]
          : []),
        ...(canSendMessages && options.includes('delete')
          ? [
              {
                text: 'Delete for everyone',
                style: 'destructive' as const,
                onPress: () => {
                  if (!valid()) return;
                  Alert.alert(
                    'Delete for everyone?',
                    'This permanently removes the message for all participants.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          if (valid())
                            void chatService.deleteMessage(conversationId, message.id).catch(() => {
                              if (valid())
                                toast.error(
                                  'Could not confirm deletion. Refresh history before trying again.',
                                );
                            });
                        },
                      },
                    ],
                  );
                },
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [myId, canSendMessages, conversationId, renderScope],
  );
  const saveEdit = () => {
    if (!editing || !editText.trim() || !isSessionCurrent(renderScope)) return;
    const scope = renderScope;
    const id = editing.id,
      text = editText;
    Alert.alert('Save edit?', 'Replace this message for all participants?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: () => {
          if (!isSessionCurrent(scope)) return;
          void chatService
            .editMessage(conversationId, id, text)
            .then(() => {
              if (isSessionCurrent(scope)) {
                setEditing(undefined);
                setEditText('');
              }
            })
            .catch(() => {
              if (isSessionCurrent(scope))
                toast.error('Could not confirm edit. Refresh history before trying again.');
            });
        },
      },
    ]);
  };
  const [jumpTarget, setJumpTarget] = useState<string>();
  const jumpFirstUnread = () => {
    if (!isSessionCurrent(renderScope)) return;
    const index = allMessages.findIndex((message) => message.id === firstUnread);
    if (index < 0 || !firstUnread) return;
    updateRoom(conversationId, {
      window: Math.max(roomState(conversationId).window, allMessages.length - index),
    });
    setJumpTarget(firstUnread);
  };
  const scrollRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scrollRetry.current), []);
  useEffect(() => {
    if (!jumpTarget) return;
    const index = rows.findIndex((row) => row.type === 'message' && row.message.id === jumpTarget);
    if (index >= 0)
      requestAnimationFrame(() => {
        if (!isSessionCurrent(renderScope)) return;
        listRef.current?.scrollToIndex({ index, animated: true });
        setJumpTarget(undefined);
      });
  }, [rows, jumpTarget, renderScope]);
  const seenIncoming = useRef<Set<string> | undefined>(undefined);
  const [newIncoming, setNewIncoming] = useState(0);
  useEffect(
    () =>
      registerSessionTeardown(() => {
        seenIncoming.current = undefined;
        setNewIncoming(0);
        setJumpTarget(undefined);
        clearTimeout(scrollRetry.current);
      }),
    [],
  );
  useEffect(() => {
    const ids = allMessages
      .filter((message) => !message.local && message.senderId !== myId)
      .map((message) => message.id);
    const added = seenIncoming.current
      ? ids.filter((id) => !seenIncoming.current!.has(id)).length
      : 0;
    seenIncoming.current = new Set(ids);
    if (showJump && added) setNewIncoming((count) => count + added);
    if (!showJump) setNewIncoming(0);
  }, [allMessages, myId, showJump]);

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) => (
      <View style={styles.inverted}>
        {item.type === 'divider' ? (
          <DateDivider label={item.label} />
        ) : (
          <MessageBubble
            message={item.message}
            mine={item.message.senderId === myId}
            first={item.first}
            last={item.last}
            onRetry={retry}
            onResync={resync}
            onActions={openActions}
            group={isGroup}
          />
        )}
      </View>
    ),
    [isGroup, myId, retry, resync, openActions],
  );

  if (notFound) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Conversation not found"
          message="This conversation may have been removed, or the person is no longer available."
          actionLabel="Back to messages"
          onAction={() => router.replace('/chats')}
        />
      </SafeAreaView>
    );
  }

  const participant = conversation?.participant;
  const initialLoading = messagesQuery.isPending && messages.length === 0;
  const loadFailed = messagesQuery.isError && !messagesQuery.data;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          hitSlop={6}
          onPress={goBack}
          style={({ pressed }) => [
            styles.back,
            pressed && { backgroundColor: theme.colors.surfacePressed },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        {participant ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${participant.name}'s profile`}
            onPress={() =>
              conversation?.kind === 'group'
                ? router.push({ pathname: '/groups/[id]', params: { id: participant.id } })
                : router.push(`/profile/${participant.id}`)
            }
            style={styles.person}
          >
            <Avatar uri={participant.avatarUri} label={participant.name} size={40} />
            <View style={styles.personCopy}>
              <Text variant="subheading" serif numberOfLines={1}>
                {participant.name}
              </Text>
              {subtitle ? (
                <Text
                  variant="caption"
                  color={typingLabel ? 'primary' : 'secondary'}
                  numberOfLines={1}
                  accessibilityLiveRegion="polite"
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ) : (
          <View style={styles.person}>
            <Skeleton style={styles.headerAvatar} />
            <Skeleton style={styles.headerName} />
          </View>
        )}
      </View>

      {messagesQuery.isRefetchError && messagesQuery.data ? (
        <OfflineBanner message="Can't reach the server. We'll keep trying." />
      ) : null}

      <Modal
        visible={Boolean(editing)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditing(undefined);
          setEditText('');
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: theme.colors.overlay,
          }}
        >
          <View
            style={{
              padding: 20,
              gap: 16,
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: 16,
            }}
          >
            <Text variant="subheading">Edit message</Text>
            <TextInput
              accessibilityLabel="Edit message text"
              multiline
              maxLength={2000}
              value={editText}
              onChangeText={setEditText}
              style={{ color: theme.colors.text, minHeight: 80, fontFamily: typography.fontFamily }}
            />
            <Pressable accessibilityRole="button" onPress={saveEdit}>
              <Text color="primary">Save edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(undefined);
                setEditText('');
              }}
            >
              <Text>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {!isGroup && firstUnread && allMessages.some((message) => message.id === firstUnread) ? (
        <Pressable accessibilityRole="button" onPress={jumpFirstUnread} style={{ padding: 12 }}>
          <Text color="primary">Jump to first unread</Text>
        </Pressable>
      ) : null}
      <KeyboardAvoidingScreen>
        <View style={styles.body}>
          {initialLoading ? (
            <MessagesSkeleton />
          ) : loadFailed ? (
            <ErrorState
              onRetry={() => void messagesQuery.refetch()}
              message="We couldn't load this conversation."
            />
          ) : messages.length === 0 && participant ? (
            <EmptyState
              icon="sparkles-outline"
              title="No messages yet"
              message={`Start the conversation in ${participant.name}.`}
            />
          ) : (
            <FlashList
              ref={listRef}
              style={styles.inverted}
              data={rows}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={onScroll}
              scrollEventThrottle={64}
              // Keep the reader's place when new messages arrive, but follow along if they're at the bottom.
              maintainVisibleContentPosition={{
                autoscrollToTopThreshold: 120,
              }}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                <View style={styles.inverted}>
                  {loadingOlder ? (
                    <Loader />
                  ) : olderError ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadOlder()}
                      style={styles.older}
                    >
                      <Text variant="caption" color="primary">
                        Couldn't load earlier messages. Tap to retry.
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          )}
          {showJump ? (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.jumpWrap}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Jump to latest messages. ${newIncoming} new incoming messages`}
                onPress={scrollToLatest}
                style={[
                  styles.jump,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Ionicons name="arrow-down" size={20} color={theme.colors.text} />
                {newIncoming > 0 ? <Text variant="caption">{newIncoming}</Text> : null}
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
        {typingLabel ? <TypingDots /> : null}
        <ChatInput
          timerLabel={timerShortLabel(ttlSeconds)}
          onTimerPress={featureFlags.ENABLE_EPHEMERAL_CHAT ? () => setTimerSheet(true) : undefined}
          draftValue={draft}
          onDraftChange={(text) => {
            if (isSessionCurrent(renderScope)) updateRoom(conversationId, { draft: text });
          }}
          onSend={onSend}
          onChangeText={typing.onChangeText}
          onAttach={canShareMedia ? () => attach.mutate() : undefined}
          canSendMessages={canSendMessages}
          canShareMedia={canShareMedia}
          disabled={
            !conversation ||
            conversationQuery.isError ||
            (messagesQuery.isError &&
              (!messagesQuery.data || !isServiceError(messagesQuery.error, 'NETWORK'))) ||
            attach.isPending
          }
          bottomInset={keyboardVisible ? 0 : insets.bottom}
          placeholder={participant ? `Message ${participant.name}…` : 'Write a message…'}
        />
      </KeyboardAvoidingScreen>
      <TimerSheet
        visible={timerSheet}
        value={ttlSeconds}
        onChange={setTtlSeconds}
        onClose={() => setTimerSheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // FlashList v2 uses a mirrored viewport and cells for newest-first chat rows.
  inverted: { transform: [{ scaleY: -1 }] },
  root: { flex: 1 },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  personCopy: { flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: radius.full },
  headerName: { width: 120 },
  body: { flex: 1, width: '100%', maxWidth: spacing.contentMax + 120, alignSelf: 'center' },
  list: { paddingHorizontal: spacing.screen, paddingVertical: spacing.md },
  skeleton: { flex: 1, justifyContent: 'flex-end', padding: spacing.screen, gap: spacing.md },
  skeletonBubble: { height: 40, borderRadius: radius.lg },
  skeletonMine: { alignSelf: 'flex-end' },
  jumpWrap: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  older: { alignItems: 'center', paddingVertical: spacing.md },
  jump: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
