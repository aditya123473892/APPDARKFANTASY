import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Loader, PostCard, Text } from '@/components/ui';
import { InterestChips } from '../components/InterestChips';
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
        contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg }}
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
        <Header title="Profile" back backFallback="/discover" />
        <Button label="Report user" variant="secondary" onPress={() => router.push({ pathname: '/report' as never, params: { targetType: 'user', targetId: id } })} />
        {blocked ? (
          <>
            <EmptyState title="You blocked this user" message="Unblock to see their profile again." />
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
            <View style={{ gap: spacing.lg, alignItems: 'center' }}>
              <Avatar uri={profile.data.avatarUri} label={profile.data.name} size={112} ring />
              <View style={{ alignSelf: 'stretch' }}>
                <ProfileHeader user={profile.data} centered />
              </View>
            </View>
            {profile.data.bio ? <Text center>{profile.data.bio}</Text> : null}
            <InterestChips interests={profile.data.interests} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                label="Message"
                style={{ flex: 1 }}
                onPress={() => router.push(`/chat/user:${id}`)}
              />
              <Button
                label={follow.requested ? 'Requested' : 'Follow'}
                variant="secondary"
                style={{ flex: 1 }}
                loading={follow.pending}
                disabled={follow.requested}
                onPress={follow.follow}
              />
            </View>
            <Text variant="subheading">Posts</Text>
            <Button
              label="Block user"
              variant="secondary"
              disabled={block.isPending}
              onPress={() => block.confirm(id)}
            />
            {posts.isPending ? (
              <Loader />
            ) : posts.isError ? (
              <ErrorState onRetry={() => void posts.refetch()} />
            ) : posts.data?.length ? (
              posts.data.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onToggleLike={(item) =>
                    toggleLike.mutate({ postId: item.id, liked: !item.liked })
                  }
                />
              ))
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
