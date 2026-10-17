import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { BrandHeader, Screen } from '@/components/layout';
import { Avatar, EmptyState, Loader, PostCard, Skeleton, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { PeopleStrip } from '../components/PeopleStrip';
import { useFeed, useToggleLike } from '../hooks/useFeed';
import type { Post } from '../types';

function FeedSkeleton(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.skeleton}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeletonPost, { borderBottomColor: theme.colors.divider }]}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <Skeleton style={styles.skeletonName} />
            <Skeleton />
            <Skeleton style={styles.skeletonShort} />
            {item === 0 ? <Skeleton style={styles.skeletonMedia} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function FeedScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const me = useAuthStore((state) => state.user);
  const {
    data,
    isPending,
    isError,
    isRefetching,
    isRefetchError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useFeed();
  const toggleLike = useToggleLike();

  const onToggleLike = useCallback(
    (post: Post) => toggleLike.mutate({ postId: post.id, liked: !post.liked }),
    [toggleLike],
  );
  const onOpenAuthor = useCallback(
    (post: Post) => router.push(post.user.id === me?.id ? '/profile' : `/profile/${post.user.id}`),
    [me?.id, router],
  );

  const header = (
    <>
      {me ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a post"
          onPress={() => router.push('/create')}
          style={({ pressed }) => [
            styles.composer,
            { borderBottomColor: theme.colors.divider },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Avatar uri={me.avatarUri} label="You" size={38} />
          <View style={styles.composerCopy}>
            <Text variant="label" numberOfLines={1}>
              {me.name}
            </Text>
            <Text color="muted" numberOfLines={1}>
              What's on your mind?
            </Text>
          </View>
          <View style={[styles.postPill, { borderColor: theme.colors.border }]}>
            <Text variant="label">Post</Text>
          </View>
        </Pressable>
      ) : null}
      <PeopleStrip />
    </>
  );

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
        <FlashList<Post>
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} onToggleLike={onToggleLike} onOpenAuthor={onOpenAuthor} />
          )}
          ListHeaderComponent={header}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Loader />
            ) : isFetchNextPageError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void fetchNextPage()}
                style={styles.more}
              >
                <Text variant="caption" color="primary">
                  Couldn't load more posts. Tap to retry.
                </Text>
              </Pressable>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surfaceElevated}
            />
          }
          contentContainerStyle={styles.list}
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
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  more: { alignItems: 'center', paddingVertical: spacing.lg },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composerCopy: { flex: 1, gap: 1 },
  postPill: {
    minHeight: 34,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: { paddingHorizontal: spacing.screen },
  skeletonPost: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletonAvatar: { width: 38, height: 38, borderRadius: radius.full },
  skeletonCopy: { flex: 1, gap: spacing.sm },
  skeletonName: { width: '35%', height: 14 },
  skeletonShort: { width: '72%' },
  skeletonMedia: { height: 200, borderRadius: radius.md, marginTop: spacing.xs },
});
