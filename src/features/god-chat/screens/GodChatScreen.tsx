import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Header, KeyboardAvoidingScreen, Screen, SettingsButton } from '@/components/layout';
import { useContentInsets } from '@/components/layout/useContentInsets';
import { Button, EmptyState, IconButton, Text } from '@/components/ui';
import { Pressable } from '@/components/ui/Pressable';
import { toast } from '@/components/ui/Toast';
import { ChatInput } from '@/features/chat/components/ChatInput';
import { TypingDots } from '@/features/chat/components/TypingDots';
import { useChatVisibility } from '@/features/chat/hooks/useChat';
import { KeyboardInsetSpacer } from '@/components/layout/KeyboardInsetSpacer';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { createClientId } from '@/utils/clientId';
import { GodChatBubble } from '../components/GodChatBubble';
import {
  godChatStatus,
  GodChatLimitError,
  GOD_CHAT_MAX_CHARS,
  loadGodSession,
  sendToGod,
  startNewGodChat,
  type GodChatMessage,
} from '../godChatService';

import { dialog } from '@/components/ui/dialogStore';
import { create } from 'zustand';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';

/** How close to the latest message (in points) still counts as reading it. */
const NEAR_BOTTOM_PX = 120;
const SESSION_KEY = ['god-chat-session'] as const;
/** Faster while a team member is answering, so their replies feel live. */
const STAFF_POLL_MS = 3_000;
const AI_POLL_MS = 8_000;

const GREETING: GodChatMessage = {
  id: 'greeting',
  role: 'assistant',
  by: 'ai',
  at: '',
  content:
    'This space is for adult fantasies, desires, sex life, intimacy and sexual wellbeing, without judgment. Share only what feels comfortable. What would you like to explore?',
};

const TOPICS = [
  { label: 'Explore a fantasy', prompt: 'I want to understand a fantasy without feeling judged.' },
  {
    label: 'Sex & intimacy',
    prompt: 'I would like to talk about my sex life and what I need from intimacy.',
  },
  { label: 'Share my desires', prompt: 'How can I talk to my partner about my desires?' },
  {
    label: 'My boundaries',
    prompt: 'I want to understand my boundaries and what feels comfortable for me.',
  },
];

/**
 * The unsent message. Kept outside the screen so typing re-renders only the input; the
 * topic chips and "New chat" write to it without subscribing.
 */
const useDraft = create(() => ({ draft: '' }));
const setDraft = (draft: string) => useDraft.setState({ draft });
// Never carry an unsent message over to the next account.
registerSessionTeardown(() => setDraft(''));

function GodChatComposer(
  props: Omit<React.ComponentProps<typeof ChatInput>, 'draftValue' | 'onDraftChange'>,
): React.JSX.Element {
  const draft = useDraft((state) => state.draft);
  return (
    <ChatInput
      {...props}
      maxLength={GOD_CHAT_MAX_CHARS}
      draftValue={draft}
      onDraftChange={setDraft}
    />
  );
}

const renderBubble = ({ item }: { item: GodChatMessage }) => (
  <GodChatBubble
    message={item}
    mine={item.role === 'user'}
    label={item.role === 'assistant' ? authorLabel(item) : undefined}
  />
);

const authorLabel = (message: GodChatMessage) =>
  message.by === 'staff' ? 'DARKFANTASY team' : 'God';

/** The conversation is stored on the server, where an admin may take it over and answer in person. */
export function GodChatScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const contentInsets = useContentInsets();
  const visible = useChatVisibility();
  const listRef = useRef<FlatList<GodChatMessage>>(null);
  /** Whether the reader is at the latest message; only then does the list follow along. */
  const nearBottom = useRef(true);
  // The message being sent; kept after a failure so "Try again" reuses its id.
  const [pending, setPending] = useState<{ id: string; content: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ['god-chat-status'],
    queryFn: godChatStatus,
    staleTime: 60_000,
    retry: 1,
  });
  const [limitHit, setLimitHit] = useState(false);
  const quota = status.data?.quota;
  const freeLeft = quota && !quota.unlimited ? quota.remaining : null;
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: loadGodSession,
    refetchInterval: (query) =>
      visible ? (query.state.data?.mode === 'staff' ? STAFF_POLL_MS : AI_POLL_MS) : false,
  });
  const withTeam = session.data?.mode === 'staff';
  // Only a confirmed "not configured" disables the chat; a team member can still answer then.
  const unavailable = status.data?.available === false && !withTeam;
  // Free members who used today's messages can still write to a team member who took over.
  // The server's count wins once known, so the prompt clears by itself on a new day.
  const outOfMessages = !withTeam && (freeLeft === null ? limitHit : freeLeft === 0);

  const ask = useMutation({
    mutationFn: (message: { id: string; content: string }) =>
      sendToGod(message.id, message.content),
    onSuccess: (next) => {
      setFailure(null);
      setPending(null);
      queryClient.setQueryData(SESSION_KEY, next);
      void status.refetch();
    },
    onError: (error) => {
      if (error instanceof GodChatLimitError) {
        // The message was not stored; drop it and show the upgrade prompt instead.
        setLimitHit(true);
        setPending(null);
        setFailure(null);
        void status.refetch();
        return;
      }
      setFailure(describeError(error));
      // The message itself may have been stored even though the reply failed.
      void session.refetch();
    },
  });

  const fresh = useMutation({
    mutationFn: startNewGodChat,
    onSuccess: () => {
      setDraft('');
      setPending(null);
      setFailure(null);
      queryClient.setQueryData(SESSION_KEY, null);
      void queryClient.invalidateQueries({ queryKey: ['god-chat-history'] });
    },
    onError: () => toast.error('Couldn’t start a new chat. Please try again.'),
  });

  const send = (text: string) => {
    if (text.length > GOD_CHAT_MAX_CHARS) {
      toast.error(`Keep your question under ${GOD_CHAT_MAX_CHARS} characters.`);
      return;
    }
    const message = { id: createClientId(), content: text };
    // Sending always brings the conversation to the latest message.
    nearBottom.current = true;
    setPending(message);
    setFailure(null);
    ask.mutate(message);
  };

  const confirmNewChat = () =>
    dialog.alert(
      'Start a new chat?',
      'Your current conversation will be closed and kept in Past chats.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New chat', onPress: () => fresh.mutate() },
      ],
    );

  const stored = useMemo(() => session.data?.messages ?? [], [session.data]);
  const data = useMemo(() => {
    const rows: GodChatMessage[] = [GREETING, ...stored];
    if (pending && !stored.some((message) => message.id === pending.id))
      rows.push({ ...pending, role: 'user', by: 'user', at: '' });
    return rows;
  }, [stored, pending]);
  // Scroll down only when something new appears (a message, the typing dots or an error),
  // not on every layout pass.
  const scrolledFor = useRef('');
  const contentKey = `${data.length}:${ask.isPending}:${Boolean(failure)}`;
  const onContentSizeChange = useCallback(() => {
    if (scrolledFor.current === contentKey) return;
    scrolledFor.current = contentKey;
    // Someone reading earlier messages stays where they are when a reply arrives.
    if (nearBottom.current) listRef.current?.scrollToEnd({ animated: true });
  }, [contentKey]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearBottom.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < NEAR_BOTTOM_PX;
  }, []);

  return (
    <KeyboardAvoidingScreen>
      <Screen padded={false} edges={['top', 'left', 'right']} style={styles.screen}>
        <View style={styles.header}>
          <Header
            title="Chat with God"
            subtitle={withTeam ? 'A team member is with you' : 'Fantasies, intimacy & desires · AI'}
            action={
              <View style={styles.actions}>
                <IconButton
                  icon="time-outline"
                  label="Past chats"
                  onPress={() => router.push('/god-history' as Href)}
                />
                {stored.length > 0 && (
                  <IconButton
                    icon="create-outline"
                    label="Start a new chat"
                    disabled={fresh.isPending || ask.isPending}
                    onPress={confirmNewChat}
                  />
                )}
                <SettingsButton />
              </View>
            }
          />
        </View>
        {unavailable ? (
          <EmptyState
            icon="moon-outline"
            title="God is not awake yet"
            message="Chat with God hasn't been set up on the server. Check back soon."
          />
        ) : (
          <FlatList
            style={styles.timeline}
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: contentInsets.bottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            scrollEventThrottle={64}
            // The keyboard or a taller input resizes the list: keep the latest message in
            // view only for someone already reading it.
            onLayout={() => {
              if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false });
            }}
            ListHeaderComponent={
              <View style={styles.intro}>
                <Text variant="caption" color="muted" center style={styles.notice}>
                  Chats are saved. The DARKFANTASY team can read them and may join to help you.
                </Text>
                {freeLeft !== null && !outOfMessages && quota ? (
                  <Text variant="caption" color="secondary" center>
                    {freeLeft} of {quota.limit} free messages left today
                  </Text>
                ) : null}
                {stored.length === 0 && !pending && !withTeam ? (
                  <View style={styles.topics}>
                    {TOPICS.map((topic) => (
                      <Pressable
                        key={topic.label}
                        accessibilityRole="button"
                        accessibilityLabel={topic.label}
                        accessibilityHint="Adds a conversation starter to your message. You can edit it before sending."
                        disabled={unavailable || ask.isPending || fresh.isPending}
                        onPress={() => setDraft(topic.prompt)}
                        style={({ pressed }) => [
                          styles.topic,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: pressed
                              ? theme.colors.surfacePressed
                              : theme.colors.surface,
                          },
                        ]}
                      >
                        <Text variant="caption" color="primary">
                          {topic.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            }
            renderItem={renderBubble}
            ListFooterComponent={
              ask.isPending && !withTeam ? (
                <View style={styles.typing}>
                  <TypingDots />
                </View>
              ) : failure && pending ? (
                <View style={styles.failure}>
                  <Text color="danger" center>
                    {failure}
                  </Text>
                  <Button
                    label="Try again"
                    variant="secondary"
                    onPress={() => ask.mutate(pending)}
                  />
                </View>
              ) : outOfMessages ? (
                <View
                  style={[
                    styles.teamBanner,
                    styles.limitBanner,
                    { borderColor: theme.colors.gold, backgroundColor: theme.colors.overlay },
                  ]}
                >
                  <Text weight="semibold" center style={{ color: theme.colors.gold }}>
                    You’ve used your {quota?.limit ?? 10} free messages for today
                  </Text>
                  <Text variant="caption" color="secondary" center>
                    Go premium for unlimited chats with God, or come back after{' '}
                    {quota
                      ? new Date(quota.resetsAt).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'midnight UTC'}
                    .
                  </Text>
                  <Button
                    label="Go premium"
                    icon="sparkles-outline"
                    onPress={() => router.push('/subscribe' as Href)}
                  />
                </View>
              ) : withTeam ? (
                <View
                  style={[
                    styles.teamBanner,
                    { borderColor: theme.colors.gold, backgroundColor: theme.colors.overlay },
                  ]}
                >
                  <Text variant="caption" style={{ color: theme.colors.gold }} center>
                    You’re chatting with a person from the DARKFANTASY team, not the AI.
                  </Text>
                </View>
              ) : undefined
            }
          />
        )}
        <GodChatComposer
          minimal
          onSend={send}
          canSendMessages
          disabled={unavailable || outOfMessages || ask.isPending || fresh.isPending}
          bottomInset={0}
          placeholder={
            withTeam
              ? 'Message the team…'
              : outOfMessages
                ? 'No free messages left today'
                : 'Explore your fantasies or desires…'
          }
        />
        <KeyboardInsetSpacer
          inset={contentInsets.inTabs ? 0 : contentInsets.bottom}
          color={theme.colors.chatBackground}
        />
      </Screen>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.md, marginBottom: spacing.md },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  topic: {
    minHeight: spacing.touch,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
  },
  screen: { flex: 1, minHeight: 0 },
  timeline: { flex: 1, minHeight: 0 },
  header: { paddingHorizontal: spacing.screen },
  actions: { flexDirection: 'row', alignItems: 'center' },
  list: { padding: spacing.screen, gap: spacing.md },
  notice: { paddingHorizontal: spacing.lg },
  typing: { alignSelf: 'flex-start', marginTop: spacing.sm },
  failure: { gap: spacing.sm, marginTop: spacing.md },
  limitBanner: { gap: spacing.sm, padding: spacing.md },
  teamBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
});
