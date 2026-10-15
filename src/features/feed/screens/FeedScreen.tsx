import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { BrandHeader, Screen } from '@/components/layout';
import { Avatar, EmptyState, PostCard, Skeleton, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useFeed, useToggleLike } from '../hooks/useFeed';
import type { Post } from '../types';

function FeedSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeleton}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <Skeleton style={styles.skeletonAvatar} />
            <View style={styles.skeletonCopy}>
              <Skeleton style={styles.skeletonName} />
              <Skeleton style={styles.skeletonMeta} />
            </View>
          </View>
          <Skeleton />
          <Skeleton style={styles.skeletonShort} />
        </View>
      ))}
    </View>
  );
}

export function FeedScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const me = useAuthStore((state) => state.user);
  const { data, isPending, isError, isRefetching, isRefetchError, refetch } = useFeed();
  const toggleLike = useToggleLike();

  const onToggleLike = useCallback(
    (post: Post) => toggleLike.mutate({ postId: post.id, liked: !post.liked }),
    [toggleLike],
  );
  const onOpenAuthor = useCallback(
    (post: Post) => router.push(post.user.id === me?.id ? '/profile' : `/profile/${post.user.id}`),
    [me?.id, router],
  );

  const composer = me ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a post"
      onPress={() => router.push('/create')}
      style={({ pressed }) => [
        styles.composer,
        {
          backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Avatar uri={me.avatarUri} label="You" size={36} />
      <Text color="muted" style={styles.composerText}>
        Share something about your day…
      </Text>
    </Pressable>
  ) : null;

  return (
    <Screen padded={false}>
      <BrandHeader />
      {isRefetchError && data ? (
        <OfflineBanner message="Can't refresh right now. Showing saved posts." />
      ) : null}
      {isPending ? (
        <FeedSkeleton />
      ) : isError && !data ? (
        <ErrorState onRetry={() => void refetch()} message="We couldn't load your feed." />
      ) : (
        <FlatList<Post>
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} onToggleLike={onToggleLike} onOpenAuthor={onOpenAuthor} />
          )}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          ListHeaderComponent={composer}
          ListHeaderComponentStyle={styles.header}
          initialNumToRender={5}
          windowSize={9}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surfaceElevated}
            />
          }
          contentContainerStyle={data.length ? styles.list : [styles.list, styles.empty]}
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="Quiet for now"
              message="Approved public posts from the backend will appear here."
              actionLabel="Write the first post"
              onAction={() => router.push('/create')}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, paddingBottom: spacing.xxxl },
  empty: { flexGrow: 1 },
  header: { marginBottom: spacing.md },
  gap: { height: spacing.md },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerText: { flex: 1 },
  skeleton: { padding: spacing.screen, gap: spacing.md },
  skeletonCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  skeletonRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  skeletonAvatar: { width: 42, height: 42, borderRadius: 999 },
  skeletonCopy: { flex: 1, gap: spacing.sm },
  skeletonName: { width: '40%' },
  skeletonMeta: { width: '25%', height: 12 },
  skeletonShort: { width: '72%' },
});
