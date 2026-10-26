import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter, type Href } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, Tabs, Text } from '@/components/ui';
import { useChatVisibility } from '@/features/chat/hooks/useChat';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import { listGodSessions, type AdminGodSession, type GodSessionFilter } from './godChatAdmin';

const sections = ['Ongoing', 'Live now', 'Taken over'] as const;
type Section = (typeof sections)[number];
const filterFor: Record<Section, GodSessionFilter> = {
  Ongoing: 'open',
  'Live now': 'live',
  'Taken over': 'staff',
};
const LIST_POLL_MS = 10_000;
const when = (value: string) => new Date(value).toLocaleString();

function SessionRow({ item, onPress }: { item: AdminGodSession; onPress: () => void }) {
  const { theme } = useTheme();
  const last = item.lastMessage;
  const who = !last ? '' : last.by === 'user' ? '' : last.by === 'staff' ? 'Team: ' : 'God: ';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`God chat with ${item.user.name}${item.live ? ', live' : ''}${item.mode === 'staff' ? ', taken over' : ''}`}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: item.mode === 'staff' ? theme.colors.gold : theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Avatar uri={item.user.avatar} size={40} online={item.live} label={item.user.name} />
      <View style={styles.grow}>
        <View style={styles.rowTop}>
          <Text variant="label" numberOfLines={1} style={styles.grow}>
            {item.user.name}
          </Text>
          <Text
            variant="caption"
            style={{ color: item.mode === 'staff' ? theme.colors.gold : theme.colors.textMuted }}
          >
            {item.mode === 'staff' ? `With ${item.staff?.name ?? 'staff'}` : 'AI'}
          </Text>
        </View>
        {last ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {who}
            {last.content}
          </Text>
        ) : null}
        <Text variant="caption" color="muted">
          {item.live ? 'Live · ' : ''}
          {item.messageCount} message{item.messageCount === 1 ? '' : 's'} · {when(item.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function Sessions({ filter }: { filter: GodSessionFilter }) {
  const router = useRouter();
  const visible = useChatVisibility();
  const query = useInfiniteQuery({
    queryKey: ['admin-god-sessions', filter],
    queryFn: ({ pageParam }) => listGodSessions(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next,
    refetchInterval: visible ? LIST_POLL_MS : false,
  });
  if (query.isPending) return <ActivityIndicator style={styles.empty} />;
  if (query.isError)
    return (
      <View style={styles.empty}>
        <Text color="danger" center>
          {query.error instanceof Error ? query.error.message : 'Couldn’t load sessions.'}
        </Text>
        <Button
          label="Try again"
          variant="secondary"
          fullWidth={false}
          onPress={() => void query.refetch()}
        />
      </View>
    );
  return (
    <FlatList
      data={query.data.pages.flatMap((page) => page.sessions)}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <SessionRow item={item} onPress={() => router.push(`/admin/god-chat/${item.id}` as Href)} />
      )}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      ListEmptyComponent={
        <Text color="secondary" center style={styles.empty}>
          No sessions here right now.
        </Text>
      }
      contentContainerStyle={styles.list}
    />
  );
}

/** Admin console: every open "Chat with God" conversation, newest activity first. */
export function GodSessionsScreen(): React.JSX.Element {
  const [section, setSection] = useState<Section>('Ongoing');
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="God chat sessions" back backFallback="/settings" />
      <Tabs items={sections} value={section} onChange={setSection} variant="segmented" />
      <View style={styles.body}>
        <Sessions key={section} filter={filterFor[section]} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  empty: { marginTop: spacing.huge, gap: spacing.md, alignItems: 'center' },
});
