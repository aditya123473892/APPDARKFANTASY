import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Header, KeyboardAvoidingScreen, Screen, SettingsButton } from '@/components/layout';
import { useContentInsets } from '@/components/layout/useContentInsets';
import { Button, EmptyState, IconButton, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ChatInput } from '@/features/chat/components/ChatInput';
import { TypingDots } from '@/features/chat/components/TypingDots';
import { useChatVisibility } from '@/features/chat/hooks/useChat';
import { useKeyboard } from '@/hooks/useKeyboard';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { createClientId } from '@/utils/clientId';
import { GodChatBubble } from '../components/GodChatBubble';
import {
  godChatAvailable,
  GOD_CHAT_MAX_CHARS,
  loadGodSession,
  sendToGod,
  startNewGodChat,
  type GodChatMessage,
} from '../godChatService';

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
    'Welcome, wanderer. I know the ways of DARKFANTASY: posts, chats, events, the Vault and more. What do you seek?',
};

const authorLabel = (message: GodChatMessage) =>
  message.by === 'staff' ? 'DARKFANTASY team' : 'God';

/** The conversation is stored on the server, where an admin may take it over and answer in person. */
export function GodChatScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const contentInsets = useContentInsets();
  const keyboardVisible = useKeyboard();
  const visible = useChatVisibility();
  const listRef = useRef<FlatList<GodChatMessage>>(null);
  // The message being sent; kept after a failure so "Try again" reuses its id.
  const [pending, setPending] = useState<{ id: string; content: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ['god-chat-status'],
    queryFn: godChatAvailable,
    staleTime: 60_000,
    retry: 1,
  });
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: loadGodSession,
    refetchInterval: (query) =>
      visible ? (query.state.data?.mode === 'staff' ? STAFF_POLL_MS : AI_POLL_MS) : false,
  });
  const withTeam = session.data?.mode === 'staff';
  // Only a confirmed "not configured" disables the chat; a team member can still answer then.
  const unavailable = status.data === false && !withTeam;

  const ask = useMutation({
    mutationFn: (message: { id: string; content: string }) =>
      sendToGod(message.id, message.content),
    onSuccess: (next) => {
      setFailure(null);
      setPending(null);
      queryClient.setQueryData(SESSION_KEY, next);
    },
    onError: (error) => {
      setFailure(describeError(error));
      // The message itself may have been stored even though the reply failed.
      void session.refetch();
    },
  });

  const fresh = useMutation({
    mutationFn: startNewGodChat,
    onSuccess: () => {
      setPending(null);
      setFailure(null);
      queryClient.setQueryData(SESSION_KEY, null);
    },
    onError: () => toast.error('Couldn’t start a new chat. Please try again.'),
  });

  const send = (text: string) => {
    if (text.length > GOD_CHAT_MAX_CHARS) {
      toast.error(`Keep your question under ${GOD_CHAT_MAX_CHARS} characters.`);
      return;
    }
    const message = { id: createClientId(), content: text };
    setPending(message);
    setFailure(null);
    ask.mutate(message);
  };

  const confirmNewChat = () =>
    Alert.alert('Start a new chat?', 'Your current conversation will be closed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New chat', onPress: () => fresh.mutate() },
    ]);

  const stored = session.data?.messages ?? [];
  const data: GodChatMessage[] = [GREETING, ...stored];
  if (pending && !stored.some((message) => message.id === pending.id))
    data.push({ ...pending, role: 'user', by: 'user', at: '' });

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Header
          title="Chat with God"
          subtitle={withTeam ? 'A team member is with you' : 'AI guide to the app'}
          action={
            <View style={styles.actions}>
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
      <KeyboardAvoidingScreen>
        {unavailable ? (
          <EmptyState
            icon="moon-outline"
            title="God is not awake yet"
            message="Chat with God hasn't been set up on the server. Check back soon."
          />
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: contentInsets.bottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListHeaderComponent={
              <Text variant="caption" color="muted" center style={styles.notice}>
                Chats are saved. The DARKFANTASY team can read them and may join to help you.
              </Text>
            }
            renderItem={({ item }) => (
              <GodChatBubble
                message={item}
                mine={item.role === 'user'}
                label={item.role === 'assistant' ? authorLabel(item) : undefined}
              />
            )}
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
        <ChatInput
          minimal
          onSend={send}
          canSendMessages
          disabled={unavailable || ask.isPending || fresh.isPending}
          bottomInset={keyboardVisible || contentInsets.inTabs ? 0 : contentInsets.bottom}
          placeholder={withTeam ? 'Message the team…' : 'Ask God anything about the app…'}
        />
      </KeyboardAvoidingScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.screen },
  actions: { flexDirection: 'row', alignItems: 'center' },
  list: { padding: spacing.screen, gap: spacing.md },
  notice: { paddingHorizontal: spacing.lg },
  typing: { alignSelf: 'flex-start', marginTop: spacing.sm },
  failure: { gap: spacing.sm, marginTop: spacing.md },
  teamBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
});
