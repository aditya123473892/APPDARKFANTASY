import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { KeyboardAvoidingScreen, useSafeBack } from '@/components/layout';
import { Avatar, EmptyState, Loader, Skeleton, Text } from '@/components/ui';
import { useKeyboard } from '@/hooks/useKeyboard';
import { isServiceError, describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatPresence } from '@/utils/formatters';
import { ChatInput } from '../components/ChatInput';
import { DateDivider } from '../components/DateDivider';
import { useMutation } from '@tanstack/react-query';
import { pickMedia } from '@/features/create-post/pickMedia';
import { chatService } from '../services';
import { toast } from '@/components/ui/Toast';
import { sessionIdentity, isSessionCurrent } from '@/features/auth/sessionRuntime';
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
  useVisiblePresence,
} from '../hooks/useChat';
import { buildRows, type ChatRow as Row } from '../utils/buildRows';

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
  const attach = useMutation({
    mutationFn: async () => {
      const scope = sessionIdentity.generation;
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
      try {
        await chatService.sendMessage({
          conversationId,
          text: '',
          assets,
          clientId: createClientId(),
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
  const listRef = useRef<FlatList<Row>>(null);
  const [showJump, setShowJump] = useState(false);

  const conversationQuery = useConversation(conversationId);
  const conversation = conversationQuery.data;
  const notFound = !conversationId || isServiceError(conversationQuery.error, 'NOT_FOUND');
  const messagesQuery = useMessages(conversationId, !notFound);
  const { messages } = messagesQuery;
  const { send, retry, discard } = useSendMessage(conversationId);
  const typing = useTypingEmitter(conversationId);
  const typingNames = useTypingNames(conversationId);
  const isGroup = conversation?.kind === 'group' || conversationId.startsWith('group:');
  const typingLabel = typingNames.length
    ? isGroup
      ? typingNames.length === 1
        ? `${typingNames[0]} is typing…`
        : `${typingNames.length} people are typing…`
      : 'typing…'
    : null;
  const presence = formatPresence(useVisiblePresence(conversation));
  const subtitle =
    typingLabel ??
    (isGroup && conversation?.memberCount ? `${conversation.memberCount} members` : presence);

  const latestIncomingId = useMemo(
    () =>
      [...messages].reverse().find((message) => !message.local && message.senderId !== myId)?.id,
    [messages, myId],
  );
  useMarkConversationRead(conversation ? conversationId : '', latestIncomingId);

  const rows = useMemo(() => buildRows(messages), [messages]);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onSend = useCallback(
    (text: string) => {
      typing.stopTyping();
      send(text);
      requestAnimationFrame(scrollToLatest);
    },
    [scrollToLatest, send, typing],
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

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) =>
      item.type === 'divider' ? (
        <DateDivider label={item.label} />
      ) : (
        <MessageBubble
          message={item.message}
          mine={item.message.senderId === myId}
          first={item.first}
          last={item.last}
          onRetry={retry}
          onDiscard={discard}
        />
      ),
    [discard, myId, retry],
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
            <Avatar
              uri={participant.avatarUri}
              label={participant.name}
              online={presence === 'Online now'}
              size={40}
            />
            <View style={styles.personCopy}>
              <Text variant="subheading" numberOfLines={1}>
                {participant.name}
              </Text>
              {subtitle ? (
                <Text
                  variant="caption"
                  color={
                    typingLabel ? 'primary' : presence === 'Online now' ? 'success' : 'secondary'
                  }
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
            <FlatList
              ref={listRef}
              inverted
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
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 120,
              }}
              initialNumToRender={20}
              windowSize={11}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingOlder ? (
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
                ) : null
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
                accessibilityLabel="Jump to latest messages"
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
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
        <ChatInput
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
