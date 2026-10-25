import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Header, KeyboardAvoidingScreen, Screen, SettingsButton } from '@/components/layout';
import { useContentInsets } from '@/components/layout/useContentInsets';
import { Button, EmptyState, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ChatInput } from '@/features/chat/components/ChatInput';
import { TypingDots } from '@/features/chat/components/TypingDots';
import { useKeyboard } from '@/hooks/useKeyboard';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { createClientId } from '@/utils/clientId';
import {
  askGod,
  godChatAvailable,
  GOD_CHAT_MAX_CHARS,
  type GodChatMessage,
} from '../godChatService';

const GREETING: GodChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content:
    'Welcome, wanderer. I know the ways of DARKFANTASY: posts, chats, events, the Vault and more. What do you seek?',
};

/** Stateless AI guide: the conversation lives only while this screen is open. */
export function GodChatScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const contentInsets = useContentInsets();
  const keyboardVisible = useKeyboard();
  const listRef = useRef<FlatList<GodChatMessage>>(null);
  const [messages, setMessages] = useState<GodChatMessage[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const status = useQuery({
    queryKey: ['god-chat-status'],
    queryFn: godChatAvailable,
    staleTime: 60_000,
    retry: 1,
  });
  // Only a confirmed "not configured" disables the chat; a failed check still lets the user try.
  const unavailable = status.data === false;

  const ask = useMutation({
    mutationFn: askGod,
    onSuccess: (reply) => {
      setFailure(null);
      setMessages((current) => [
        ...current,
        { id: createClientId(), role: 'assistant', content: reply },
      ]);
    },
    onError: (error) => setFailure(describeError(error)),
  });

  const send = (text: string) => {
    if (text.length > GOD_CHAT_MAX_CHARS) {
      toast.error(`Keep your question under ${GOD_CHAT_MAX_CHARS} characters.`);
      return;
    }
    const next = [...messages, { id: createClientId(), role: 'user' as const, content: text }];
    setMessages(next);
    setFailure(null);
    ask.mutate(next);
  };

  const data = [GREETING, ...messages];
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Header title="Chat with God" subtitle="AI guide to the app" action={<SettingsButton />} />
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
            renderItem={({ item }) => {
              const mine = item.role === 'user';
              return (
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? [styles.mine, { backgroundColor: theme.colors.primary }]
                      : [styles.theirs, { backgroundColor: theme.colors.bubbleIn }],
                  ]}
                >
                  {!mine ? (
                    <Text variant="label" color="primary" style={styles.sender}>
                      God
                    </Text>
                  ) : null}
                  <Text
                    selectable
                    style={{ color: mine ? theme.colors.onPrimary : theme.colors.text }}
                  >
                    {item.content}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              ask.isPending ? (
                <View style={styles.typing}>
                  <TypingDots />
                </View>
              ) : failure ? (
                <View style={styles.failure}>
                  <Text color="danger" center>
                    {failure}
                  </Text>
                  <Button
                    label="Try again"
                    variant="secondary"
                    onPress={() => ask.mutate(messages)}
                  />
                </View>
              ) : undefined
            }
          />
        )}
        <ChatInput
          minimal
          onSend={send}
          canSendMessages
          disabled={unavailable || ask.isPending}
          bottomInset={keyboardVisible || contentInsets.inTabs ? 0 : contentInsets.bottom}
          placeholder="Ask God anything about the app…"
        />
      </KeyboardAvoidingScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.screen },
  list: { padding: spacing.screen, gap: spacing.md },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.sm },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.sm },
  sender: { marginBottom: spacing.none },
  typing: { alignSelf: 'flex-start', marginTop: spacing.sm },
  failure: { gap: spacing.sm, marginTop: spacing.md },
});
