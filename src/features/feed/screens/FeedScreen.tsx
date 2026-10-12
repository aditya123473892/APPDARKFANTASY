import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { BrandHeader } from '@/components/layout';
import { EmptyState, PostCard, Skeleton } from '@/components/ui';
import { posts, type Post } from '@/data/posts';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

function FeedSkeleton(): React.JSX.Element {
  return <View style={styles.skeleton}>{[0, 1, 2].map((item) => <View key={item} style={styles.skeletonRow}><Skeleton style={styles.skeletonAvatar} /><View style={styles.skeletonCopy}><Skeleton style={styles.skeletonName} /><Skeleton /><Skeleton style={styles.skeletonShort} /></View></View>)}</View>;
}

export function FeedScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading] = useState(false);
  const refresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 650); }, []);
  if (loading) return <View style={[styles.root, { backgroundColor: theme.colors.background }]}><BrandHeader /><FeedSkeleton /></View>;
  return <View style={[styles.root, { backgroundColor: theme.colors.background }]}><BrandHeader />
    <FlatList<Post> data={posts} keyExtractor={(item) => item.id} renderItem={({ item }) => <PostCard post={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      contentContainerStyle={!posts.length ? styles.empty : styles.list} ListEmptyComponent={<EmptyState title="Quiet for now" message="New posts from your people will appear here." />} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, list: { paddingBottom: spacing.xxl }, empty: { flexGrow: 1 }, skeleton: { padding: spacing.lg, gap: spacing.xxl },
  skeletonRow: { flexDirection: 'row', gap: spacing.md }, skeletonAvatar: { width: 40, height: 40, borderRadius: 999 }, skeletonCopy: { flex: 1, gap: spacing.sm }, skeletonName: { width: '40%' }, skeletonShort: { width: '72%' },
});
