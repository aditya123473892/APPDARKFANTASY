import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, IconButton, Loader } from '@/components/ui';
import { ProfileGrid, useGridWindow } from '../components/ProfileGrid';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { useProfile } from '../hooks/useProfiles';
import { ProfileHeader } from '../components/ProfileHeader';
import { listUserPosts } from '@/features/feed/services/feedService.real';
import { useToggleLike } from '@/features/feed/hooks/useFeed';
import type { Post } from '@/features/feed/types';
import { useCallback } from 'react';
import { FollowButton } from '@/features/requests/components/FollowButton';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { useBlock } from '@/features/safety/useBlock';
import { useBlockState } from '@/features/safety/blockState';
import { isServiceError } from '@/services/errors';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

import { dialog } from '@/components/ui/dialogStore';
export function UserProfileScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const myId = useCurrentUserId();
  const router = useRouter();
  const { theme } = useTheme();
  const profile = useProfile(id === myId ? '' : id);
  const posts = useQuery({
    queryKey: ['user-posts', id],
    queryFn: () => listUserPosts(id),
    enabled: Boolean(id) && id !== myId,
  });
  const pull = usePullToRefresh(() => Promise.all([profile.refetch(), posts.refetch()]));
  const { mutate: like } = useToggleLike();
  const onToggleLike = useCallback(
    (item: Post) => like({ postId: item.id, liked: !item.liked }),
    [like],
  );
  const grid = useGridWindow(posts.data?.length);
  const block = useBlock();
  const blocked = useBlockState((state) => state.ids.includes(id));
  const unblocking = useBlockState((state) => state.pending.includes(id));
  if (id === myId) return <Redirect href="/profile" />;
  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={grid.onScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{ paddingBottom: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            tintColor={theme.colors.primary}
            onRefresh={pull.onRefresh}
          />
        }
      >
        <Header
          title={profile.data?.name ?? 'Profile'}
          back
          backFallback="/discover"
          action={
            <IconButton
              icon="ellipsis-horizontal"
              label="Profile options"
              onPress={() =>
                dialog.alert('Profile options', undefined, [
                  {
                    text: 'Report user',
                    onPress: () =>
                      router.push({
                        pathname: '/report' as never,
                        params: { targetType: 'user', targetId: id },
                      }),
                  },
                  ...(!blocked
                    ? [
                        {
                          text: 'Block user',
                          style: 'destructive' as const,
                          onPress: () => block.confirm(id),
                        },
                      ]
                    : []),
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          }
        />
        {blocked ? (
          <>
            <EmptyState
              title="You blocked this user"
              message="Unblock to see their profile again."
            />
            <Button
              label="Unblock"
              variant="secondary"
              loading={unblocking}
              disabled={unblocking}
              onPress={() => block.mutate({ id, blocked: false })}
            />
          </>
        ) : profile.isPending ? (
          <Loader />
        ) : isServiceError(profile.error, 'NOT_FOUND') ? (
          <EmptyState title="User not found" message="This profile is unavailable." />
        ) : profile.isError || !profile.data ? (
          <ErrorState onRetry={() => void profile.refetch()} />
        ) : (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ProfileHeader
                user={profile.data}
                posts={posts.data?.length ?? 0}
                followers={profile.data.followers}
                following={profile.data.following}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              <FollowButton userId={id} />
              <Button
                label="Message"
                variant="secondary"
                size="sm"
                style={{ flex: 1, minHeight: 40 }}
                onPress={() => router.push(`/chat/user:${id}`)}
              />
            </View>
            {posts.isPending ? (
              <Loader />
            ) : posts.isError ? (
              <ErrorState onRetry={() => void posts.refetch()} />
            ) : posts.data?.length ? (
              <ProfileGrid
                posts={posts.data}
                limit={grid.limit}
                showSaved={false}
                onToggleLike={onToggleLike}
              />
            ) : (
              <EmptyState
                compact
                icon="newspaper-outline"
                title="No posts to show"
                message="Posts available to your account will appear here."
              />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
