import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useRouter, type Href } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Tabs, Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import { reasonLabel } from './adminMedia';
import { blockSummary, listCases, listModBlocks, type ModCase } from './moderation';

const sections = ['Reports', 'Blocks', 'Most blocked'] as const;
type Section = (typeof sections)[number];
const when = (value?: string) => (value ? new Date(value).toLocaleString() : '');

function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <View style={styles.empty}>
      <Text color="danger" center>
        {error instanceof Error ? error.message : 'Couldn’t load this list.'}
      </Text>
      <Button label="Try again" variant="secondary" fullWidth={false} onPress={retry} />
    </View>
  );
}

function CaseRow({ item, onPress }: { item: ModCase; onPress: () => void }) {
  const { theme } = useTheme();
  const urgent = item.priority === 'highest' || item.restricted;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: urgent ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <Text variant="label">{reasonLabel(item.category)}</Text>
        <Text variant="caption" color={item.status === 'escalated' ? 'danger' : 'secondary'}>
          {item.status.replace(/_/g, ' ')}
        </Text>
      </View>
      <Text variant="caption" color="secondary">
        {item.targetType.replace(/_/g, ' ')} · case {item.reportId.slice(0, 8)}
        {urgent ? ' · priority' : ''}
      </Text>
      <Text variant="caption" color="muted">
        {when(item.createdAt)}
      </Text>
    </Pressable>
  );
}

function Reports() {
  const router = useRouter();
  const query = useInfiniteQuery({
    queryKey: ['mod-cases'],
    queryFn: ({ pageParam }) => listCases(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (query.isPending) return <ActivityIndicator style={styles.empty} />;
  if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <FlatList
      data={query.data.pages.flatMap((page) => page.cases)}
      keyExtractor={(item) => item.reportId}
      renderItem={({ item }) => (
        <CaseRow item={item} onPress={() => router.push(`/moderation/${item.reportId}` as Href)} />
      )}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      ListEmptyComponent={
        <Text color="secondary" center style={styles.empty}>
          No open reports.
        </Text>
      }
      contentContainerStyle={styles.list}
    />
  );
}

function Blocks() {
  const { theme } = useTheme();
  const query = useInfiniteQuery({
    queryKey: ['mod-blocks'],
    queryFn: ({ pageParam }) => listModBlocks(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (query.isPending) return <ActivityIndicator style={styles.empty} />;
  if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <FlatList
      data={query.data.pages.flatMap((page) => page.blocks)}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View
          style={[
            styles.row,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <Text>
            <Text weight="semibold">{item.blocker.name}</Text>
            <Text color="secondary"> blocked </Text>
            <Text weight="semibold">{item.blocked.name}</Text>
          </Text>
          <Text variant="caption" color="muted">
            {when(item.createdAt)}
            {item.blocked.restricted ? ' · blocked account is restricted' : ''}
          </Text>
        </View>
      )}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      ListEmptyComponent={
        <Text color="secondary" center style={styles.empty}>
          No blocks yet.
        </Text>
      }
      contentContainerStyle={styles.list}
    />
  );
}

function MostBlocked() {
  const { theme } = useTheme();
  const query = useQuery({ queryKey: ['mod-block-summary'], queryFn: blockSummary });
  if (query.isPending) return <ActivityIndicator style={styles.empty} />;
  if (query.isError) return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <FlatList
      data={query.data}
      keyExtractor={(item) => item.user.id}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.row,
            {
              borderColor: item.openReports ? theme.colors.danger : theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.rowTop}>
            <Text variant="label">
              {index + 1}. {item.user.name}
            </Text>
            <Text variant="label" color="primary">
              {item.blocks} block{item.blocks === 1 ? '' : 's'}
            </Text>
          </View>
          <Text variant="caption" color="secondary">
            {item.openReports} open report{item.openReports === 1 ? '' : 's'} · last blocked{' '}
            {when(item.lastBlockedAt)}
            {item.user.restricted ? ' · restricted' : ''}
          </Text>
        </View>
      )}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      ListEmptyComponent={
        <Text color="secondary" center style={styles.empty}>
          No blocks yet.
        </Text>
      }
      contentContainerStyle={styles.list}
    />
  );
}

/** Moderator console: open reports, recent blocks, and the most-blocked members. */
export function ModerationScreen(): React.JSX.Element {
  const [section, setSection] = useState<Section>('Reports');
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Moderation" back backFallback="/settings" />
      <Tabs items={sections} value={section} onChange={setSection} variant="segmented" />
      <View style={styles.body}>
        {section === 'Reports' ? <Reports /> : section === 'Blocks' ? <Blocks /> : <MostBlocked />}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  empty: { marginTop: spacing.huge, gap: spacing.md, alignItems: 'center' },
});
