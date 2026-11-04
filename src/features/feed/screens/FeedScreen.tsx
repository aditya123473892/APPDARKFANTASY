import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';
import { Header, Screen, SettingsButton } from '@/components/layout';
import { EmptyState, IconButton, Loader, Skeleton, Text } from '@/components/ui';
import { PostList } from '@/components/ui/PostList';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useContentInsets } from '@/components/layout/useContentInsets';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { useFeed, useToggleLike } from '../hooks/useFeed';
import type { Post } from '../types';
import { Pressable } from '@/components/ui/Pressable';
import { PendingPosts } from '@/features/create-post/PendingPosts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export function FeedScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useContentInsets();
  const me = useAuthStore((state) => state.user);
  const feed = useFeed();
  const pull = usePullToRefresh(() => feed.refetch());
  const toggle = useToggleLike();
  // Stable handlers keep every PostCard from re-rendering when the feed screen does.
  const { mutate: like } = toggle;
  const myId = me?.id;
  const toggleLike = useCallback(
    (post: Post) => like({ postId: post.id, liked: !post.liked }),
    [like],
  );
  const openAuthor = useCallback(
    (post: Post) => router.push(post.user.id === myId ? '/profile' : `/profile/${post.user.id}`),
    [router, myId],
  );
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <Header
          title="Dark"
          align="left"
          action={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <IconButton
                icon="search-outline"
                label="Search people"
                onPress={() => router.push('/search')}
              />
              <IconButton
                icon="add-outline"
                label="Create post"
                onPress={() => router.push('/create')}
              />
              <IconButton
                icon="notifications-outline"
                label="Notifications"
                onPress={() => router.push('/notifications')}
              />
              <SettingsButton />
            </View>
          }
        />
      </View>
      {feed.isRefetchError && feed.data ? (
        <OfflineBanner message="Can't refresh right now. Showing saved posts." />
      ) : null}
      <PendingPosts />
      {feed.isPending ? (
        <View>
          <Skeleton style={{ height: 56, margin: spacing.md }} />
          <Skeleton style={{ width: '100%', aspectRatio: 0.8 }} />
        </View>
      ) : feed.isError && !feed.data ? (
        <ErrorState onRetry={() => void feed.refetch()} message="We couldn't load your feed." />
      ) : (
        <PostList
          posts={feed.data ?? []}
          onToggleLike={toggleLike}
          onOpenAuthor={openAuthor}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isFetchNextPageError)
              void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <Loader />
            ) : feed.isFetchNextPageError ? (
              <Pressable
                accessibilityLabel="Retry loading posts"
                onPress={() => void feed.fetchNextPage()}
                style={{ padding: spacing.lg }}
              >
                <Text color="primary" center>
                  Couldn't load more. Tap to retry.
                </Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="camera-outline"
              title="Your feed starts here"
              message="Share a moment and start a conversation."
              actionLabel="Create post"
              onAction={() => router.push('/create')}
            />
          }
        />
      )}
    </Screen>
  );
}
