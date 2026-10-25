import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, IconButton, Loader } from '@/components/ui';
import { ProfileGrid } from '../components/ProfileGrid';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { useProfile } from '../hooks/useProfiles';
import { ProfileHeader } from '../components/ProfileHeader';
import { listUserPosts } from '@/features/feed/services/feedService.real';
import { useToggleLike } from '@/features/feed/hooks/useFeed';
import { useFollowUser } from '@/features/requests/hooks/useRequests';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { useBlock } from '@/features/safety/useBlock';
import { useBlockState } from '@/features/safety/blockState';
import { isServiceError } from '@/services/errors';
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
  const toggleLike = useToggleLike();
  const follow = useFollowUser(id);
  const block = useBlock();
  const blocked = useBlockState((state) => state.ids.includes(id));
  const unblocking = useBlockState((state) => state.pending.includes(id));
  if (id === myId) return <Redirect href="/profile" />;
  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching || posts.isRefetching}
            tintColor={theme.colors.primary}
            onRefresh={() => {
              void profile.refetch();
              void posts.refetch();
            }}
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
                Alert.alert('Profile options', undefined, [
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
              <ProfileHeader user={profile.data} posts={posts.data?.length ?? 0} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              <Button
                label={follow.requested ? 'Requested' : 'Follow'}
                variant="secondary"
                size="sm"
                style={{ flex: 1, minHeight: 40 }}
                loading={follow.pending}
                disabled={follow.requested}
                onPress={follow.follow}
              />
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
                showSaved={false}
                onToggleLike={(item) => toggleLike.mutate({ postId: item.id, liked: !item.liked })}
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
