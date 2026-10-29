import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Text } from '@/components/ui';
import { Pressable } from '@/components/ui/Pressable';
import { describeError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { loadGodHistory, type PastGodChat } from '../godChatService';

const when = (value: string) => new Date(value).toLocaleString();

function PastChatRow({ item, onPress }: { item: PastGodChat; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Past chat from ${when(item.createdAt)}`}
      onPress={onPress}
      style={[
        styles.row,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
      ]}
    >
      <Text variant="label" numberOfLines={2}>
        {item.preview || 'Chat with God'}
      </Text>
      <Text variant="caption" color="muted">
        {item.messageCount} message{item.messageCount === 1 ? '' : 's'} · {when(item.updatedAt)}
      </Text>
    </Pressable>
  );
}

/** The member's earlier Chat with God conversations, kept after they start a new chat. */
export function GodChatHistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const query = useInfiniteQuery({
    queryKey: ['god-chat-history'],
    queryFn: ({ pageParam }) => loadGodHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next,
  });
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Past chats" subtitle="Chat with God" back backFallback="/god-chat" />
      {query.isPending ? (
        <ActivityIndicator style={styles.empty} />
      ) : query.isError ? (
        <View style={styles.empty}>
          <Text color="danger" center>
            {describeError(query.error)}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            fullWidth={false}
            onPress={() => void query.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={query.data.pages.flatMap((page) => page.sessions)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PastChatRow
              item={item}
              onPress={() => router.push(`/god-history/${item.id}` as Href)}
            />
          )}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title="No past chats yet"
              message="When you start a new chat, the old one is kept here."
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.md },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  empty: { marginTop: spacing.huge, gap: spacing.md, alignItems: 'center' },
});
