import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { Header, Screen } from '@/components/layout';
import { EmptyState, Input, Skeleton, Button, Text } from '@/components/ui';
import { Can } from '@/features/auth/components/Access';
import { useDebounce } from '@/hooks/useDebounce';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { ChatListItem } from '../components/ChatListItem';
import { useConversations, useMyId, useChatVisibility } from '../hooks/useChat';
import { INBOX_POLL_MS, LOCAL_SEARCH_LABEL, localSearch, prefetchInbox } from '../services/inbox';
import { chatService } from '../services';
import type { Conversation } from '../types';
import { describeError } from '@/services/errors';

function ChatsSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeleton}>
      {[0, 1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <Skeleton style={styles.skeletonName} />
            <Skeleton style={styles.skeletonLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ChatsScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const myId = useMyId();
  const visible = useChatVisibility();
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const prefetchTasks = useRef(0);
  const [search, setSearch] = useState('');
  const query = useDebounce(search.trim().toLowerCase(), 200);
  const { data, error, isPending, isError, isRefetchError, refetch, isRefetching } =
    useConversations(visible);
  const inboxKeys = data?.map((item) => item.id).join('|');
  const latestData = useRef(data);
  useEffect(() => {
    latestData.current = data;
  }, [data]);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      if (prefetchTasks.current === 0) setPreviewRefresh((value) => value + 1);
    }, INBOX_POLL_MS);
    return () => clearInterval(timer);
  }, [visible]);

  useFocusEffect(
    useCallback(() => {
      if (!visible || !inboxKeys || !latestData.current) return;
      let mounted = true;
      prefetchTasks.current++;
      void prefetchInbox(
        latestData.current,
        (key) => chatService.listMessages(key),
        () => mounted && AppState.currentState === 'active',
        previewRefresh > 0,
      )
        .catch(() => undefined)
        .finally(() => {
          prefetchTasks.current--;
        });
      return () => {
        mounted = false;
      };
    }, [inboxKeys, visible, previewRefresh]),
  );

  // Most recent activity first; live messages update `updatedAt` between refetches.
  const conversations = useMemo(() => localSearch(data ?? [], query), [data, query]);

  const open = useCallback(
    (conversation: Conversation) => router.push(`/chat/${conversation.id}`),
    [router],
  );

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header title="Chats" subtitle="Keep the spark alive" align="left" />
        <Button
          label="New message"
          icon="chatbubble-ellipses-outline"
          size="sm"
          onPress={() => router.push('/chat/new')}
        />
        <Can capability="canCreateGroups">
          <Button
            label="New group"
            icon="people-outline"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/groups/new')}
          />
        </Can>
        <Input
          accessibilityLabel={LOCAL_SEARCH_LABEL}
          icon="search-outline"
          placeholder="Local search: loaded names and messages"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Text variant="caption" color="muted">
          {LOCAL_SEARCH_LABEL} · Loaded names and messages only
        </Text>
      </View>
      {isRefetchError && data ? (
        <OfflineBanner message="Can't refresh right now. Showing saved conversations." />
      ) : null}
      {isPending ? (
        <ChatsSkeleton />
      ) : isError && !data ? (
        <ErrorState
          onRetry={() => void refetch()}
          message={describeError(error, "We couldn't load your conversations.")}
        />
      ) : (
        <FlashList
          data={conversations}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={conversations.length ? styles.list : styles.emptyList}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.colors.divider }]} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
                setPreviewRefresh((value) => value + 1);
              }}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surfaceElevated}
            />
          }
          ListEmptyComponent={
            query ? (
              <EmptyState
                icon="search-outline"
                title="No local matches"
                message="Try a different spelling, or clear the search."
                actionLabel="Clear search"
                onAction={() => setSearch('')}
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No conversations yet"
                message="Start a conversation, or create a group with the people you know."
                actionLabel="New message"
                onAction={() => router.push('/chat/new')}
              />
            )
          }
          renderItem={({ item }) => (
            <ChatListItem conversation={item} myId={myId} showPresence={false} onPress={open} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md, gap: spacing.xs },
  list: { paddingBottom: spacing.xxl },
  emptyList: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.screen + 56 + spacing.md },
  skeleton: { padding: spacing.screen, gap: spacing.xl },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonAvatar: { width: 56, height: 56, borderRadius: 999 },
  skeletonCopy: { flex: 1, gap: spacing.sm },
  skeletonName: { width: '35%' },
  skeletonLine: { width: '75%' },
});
