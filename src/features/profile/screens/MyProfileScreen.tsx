import { useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Header, Screen, SettingsButton } from '@/components/layout';
import { Button, Loader, Modal, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDeletePost, useMyPosts, useToggleLike } from '@/features/feed/hooks/useFeed';
import { getData } from '@/services/api/backend';
import { toHandle } from '@/utils/formatters';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { EditProfileForm } from '../components/EditProfileForm';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileGrid, useGridWindow } from '../components/ProfileGrid';

export function MyProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [editing, setEditing] = useState(false);
  const feed = useMyPosts();
  const counts = useQuery({
    queryKey: ['social-counts', user?.id],
    queryFn: ({ signal }) =>
      getData<{ followers: number; following: number }>('/users/follow/counts', undefined, signal),
    enabled: !!user,
  });
  const toggle = useToggleLike();
  const grid = useGridWindow();
  // Memoised so the grid's tiles only re-render when the posts change.
  const posts = useMemo(
    () => feed.data?.filter((post) => post.user.id === user?.id) ?? [],
    [feed.data, user?.id],
  );
  const remove = useDeletePost();
  if (!user)
    return (
      <Screen>
        <ErrorState
          title="Profile unavailable"
          onRetry={() => void useAuthStore.getState().refreshProfile()}
        />
      </Screen>
    );
  return (
    <Screen padded={false}>
      <ScrollView
        onScroll={grid.onScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching || counts.isRefetching}
            onRefresh={() => {
              void feed.refetch();
              void counts.refetch();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Header
            title={toHandle(user.name)}
            back
            backFallback="/home"
            action={<SettingsButton />}
          />
          <ProfileHeader
            user={user}
            posts={posts.length}
            followers={counts.data?.followers}
            following={counts.data?.following}
            onFollowersPress={() => router.push('/connections?tab=followers' as Href)}
            onFollowingPress={() => router.push('/connections?tab=following' as Href)}
          />
          {counts.isPending ? (
            <Text variant="caption" accessibilityLiveRegion="polite">
              Loading follower counts…
            </Text>
          ) : null}
          {counts.isError ? (
            <ErrorState
              compact
              title="Couldn’t refresh follow counts"
              message={
                counts.data
                  ? 'These counts may be out of date. Try again.'
                  : 'Your counts could not be loaded. Check your connection and retry.'
              }
              onRetry={() => void counts.refetch()}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Edit profile"
              variant="secondary"
              size="sm"
              style={{ flex: 1, minHeight: 40 }}
              onPress={() => setEditing(true)}
            />
            <Button
              label="Share profile"
              variant="secondary"
              size="sm"
              style={{ flex: 1, minHeight: 40 }}
              onPress={() =>
                void Share.share({
                  message: `Meet ${user.name} on DARKFANTASY. darkfantasy://profile/${user.id}`,
                })
              }
            />
          </View>
        </View>
        {feed.isPending ? (
          <Loader />
        ) : feed.isError ? (
          <ErrorState onRetry={() => void feed.refetch()} />
        ) : (
          <ProfileGrid
            posts={posts}
            limit={grid.limit}
            onToggleLike={(post) => toggle.mutate({ postId: post.id, liked: !post.liked })}
            onDelete={(post) => remove.mutate(post.id)}
          />
        )}
      </ScrollView>
      <Modal visible={editing} title="Edit profile" onClose={() => setEditing(false)}>
        <EditProfileForm user={user} onDone={() => setEditing(false)} />
      </Modal>
    </Screen>
  );
}
