import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header, KeyboardAvoidingScreen, Screen } from '@/components/layout';
import { Button, IconButton, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ChatInput } from '@/features/chat/components/ChatInput';
import { useChatVisibility, useMyId } from '@/features/chat/hooks/useChat';
import { GodChatBubble } from '@/features/god-chat/components/GodChatBubble';
import { useKeyboard } from '@/hooks/useKeyboard';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { createClientId } from '@/utils/clientId';
import {
  flagLabels,
  godSessionDetail,
  markGodSessionReviewed,
  releaseGodSession,
  replyToGodSession,
  takeOverGodSession,
  type AdminGodMessage,
  type AdminGodSessionDetail,
} from './godChatAdmin';

const DETAIL_POLL_MS = 3_000;
const MAX_REPLY_CHARS = 2000;

/** One member's God chat as staff see it: watch it live, take over, answer, hand back to the AI. */
export function GodSessionScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const myId = useMyId();
  const visible = useChatVisibility();
  const keyboardVisible = useKeyboard();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<AdminGodMessage>>(null);
  // Kept after a failed send so the retry reuses its id.
  const [pending, setPending] = useState<{ id: string; content: string } | null>(null);
  const key = ['admin-god-session', id];
  const session = useQuery({
    queryKey: key,
    queryFn: () => godSessionDetail(id),
    enabled: Boolean(id),
    refetchInterval: visible ? DETAIL_POLL_MS : false,
  });
  const update = (next: AdminGodSessionDetail) => {
    queryClient.setQueryData(key, next);
    void queryClient.invalidateQueries({ queryKey: ['admin-god-sessions'] });
  };
  const fail = (error: unknown) => toast.error(describeError(error));
  const takeOver = useMutation({
    mutationFn: () => takeOverGodSession(id),
    onSuccess: (next) => {
      update(next);
      toast.success('You’ve taken over. The AI will stay quiet until you hand back.');
    },
    onError: fail,
  });
  const release = useMutation({
    mutationFn: () => releaseGodSession(id),
    onSuccess: (next) => {
      update(next);
      toast.success('Handed back to God (AI). It will carry on from this conversation.');
    },
    onError: fail,
  });
  const reviewed = useMutation({
    mutationFn: () => markGodSessionReviewed(id),
    onSuccess: update,
    onError: fail,
  });
  const reply = useMutation({
    mutationFn: (message: { id: string; content: string }) =>
      replyToGodSession(id, message.id, message.content),
    onSuccess: (next) => {
      setPending(null);
      update(next);
    },
    onError: (error) => {
      fail(error);
      void session.refetch();
    },
  });

  if (session.isPending)
    return (
      <Screen>
        <Header title="God chat" back backFallback={'/admin/god-chat' as Href} />
        <ActivityIndicator style={styles.empty} />
      </Screen>
    );
  if (session.isError)
    return (
      <Screen>
        <Header title="God chat" back backFallback={'/admin/god-chat' as Href} />
        <View style={styles.empty}>
          <Text color="danger" center>
            {describeError(session.error)}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => void session.refetch()}
          />
        </View>
      </Screen>
    );

  const data = session.data;
  const mine = data.mode === 'staff' && data.staff?.id === myId;
  const heldByOther = data.mode === 'staff' && !mine;
  const messages: AdminGodMessage[] = [...data.messages];
  if (pending && !messages.some((message) => message.id === pending.id))
    messages.push({ ...pending, role: 'assistant', by: 'staff', staffId: myId, at: '' });

  const author = (message: AdminGodMessage) =>
    message.role === 'user'
      ? data.user.name
      : message.by === 'staff'
        ? message.staffId === myId
          ? 'You'
          : 'Team'
        : 'God (AI)';
  // Flags are shown to staff only, next to the author.
  const label = (message: AdminGodMessage) =>
    message.flags?.length
      ? `${author(message)} · ⚑ ${message.flags.map((flag) => flagLabels[flag] ?? flag).join(', ')}`
      : author(message);

  const confirmTakeOver = () =>
    heldByOther
      ? Alert.alert(
          'Take over from another admin?',
          `${data.staff?.name ?? 'Another admin'} is answering this chat. They will no longer be able to reply.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take over', style: 'destructive', onPress: () => takeOver.mutate() },
          ],
        )
      : takeOver.mutate();

  const send = (text: string) => {
    const message = { id: createClientId(), content: text.slice(0, MAX_REPLY_CHARS) };
    setPending(message);
    reply.mutate(message);
  };

  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Header
          title={data.user.name}
          subtitle={
            !data.open
              ? 'Ended by the member'
              : mine
                ? 'You are answering'
                : heldByOther
                  ? `${data.staff?.name ?? 'Another admin'} is answering`
                  : `God (AI) is answering${data.live ? ' · live' : ''}`
          }
          back
          backFallback={'/admin/god-chat' as Href}
          action={
            data.user.id ? (
              <IconButton
                icon="time-outline"
                label={`All of ${data.user.name}’s chats`}
                onPress={() =>
                  router.push(
                    `/admin/god-chat?userId=${data.user.id}&name=${encodeURIComponent(data.user.name)}` as Href,
                  )
                }
              />
            ) : undefined
          }
        />
      </View>
      {data.flagged ? (
        <View
          style={[
            styles.flagged,
            { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft },
          ]}
        >
          <Text variant="caption" color="danger" style={styles.grow}>
            ⚑ Flagged: {data.flags.map((flag) => flagLabels[flag] ?? flag).join(', ')}
          </Text>
          <Button
            label="Mark reviewed"
            variant="secondary"
            fullWidth={false}
            loading={reviewed.isPending}
            onPress={() => reviewed.mutate()}
          />
        </View>
      ) : null}
      <KeyboardAvoidingScreen>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <GodChatBubble message={item} mine={item.role === 'assistant'} label={label(item)} />
          )}
          ListEmptyComponent={
            <Text color="secondary" center style={styles.empty}>
              No messages yet.
            </Text>
          }
          ListFooterComponent={
            pending && reply.isError ? (
              <Button
                label="Retry sending"
                variant="secondary"
                onPress={() => reply.mutate(pending)}
              />
            ) : undefined
          }
        />
        {!data.open ? null : mine ? (
          <>
            <View style={[styles.bar, { borderColor: theme.colors.border }]}>
              <Text variant="caption" color="secondary" style={styles.grow}>
                The member sees your replies as “DARKFANTASY team”. When you hand back, God
                continues with your replies as context.
              </Text>
              <Button
                label="Hand back to AI"
                icon="sparkles-outline"
                variant="secondary"
                fullWidth={false}
                loading={release.isPending}
                onPress={() => release.mutate()}
              />
            </View>
            <ChatInput
              minimal
              onSend={send}
              canSendMessages
              disabled={reply.isPending}
              bottomInset={keyboardVisible ? 0 : spacing.sm}
              placeholder={`Reply to ${data.user.name}…`}
            />
          </>
        ) : (
          <View style={[styles.takeover, { borderColor: theme.colors.border }]}>
            <Button
              label={heldByOther ? 'Take over from them' : 'Take over this chat'}
              icon="hand-left-outline"
              loading={takeOver.isPending}
              onPress={confirmTakeOver}
            />
          </View>
        )}
      </KeyboardAvoidingScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.screen },
  list: { padding: spacing.screen, gap: spacing.md },
  empty: { marginTop: spacing.huge, gap: spacing.md, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  flagged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  takeover: {
    padding: spacing.screen,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
