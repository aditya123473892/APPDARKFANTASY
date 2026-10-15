import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Loader, PostCard, Text } from '@/components/ui';
import { InterestChips } from '../components/InterestChips';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { useProfile } from '../hooks/useProfiles';
import { ProfileHeader } from '../components/ProfileHeader';
import { listUserPosts } from '@/features/feed/services/feedService.real';
import { followUser } from '@/features/requests/services/requestsService.real';
import { describeError } from '@/services/errors';
import { useTheme } from '@/theme/useTheme';
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
  const follow = useMutation({
    mutationFn: () => followUser(id),
    onSuccess: () => toast.success('Follow request sent'),
    onError: (error) =>
      toast.error(describeError(error, 'Unable to follow this user. A request may already exist.')),
  });
  if (id === myId) return <Redirect href="/profile" />;
  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20 }}
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
        {profile.isPending ? (
          <Loader />
        ) : profile.isError || !profile.data ? (
          <ErrorState onRetry={() => void profile.refetch()} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Avatar uri={profile.data.avatarUri} label={profile.data.name} size={88} />
              <View style={{ flex: 1 }}>
                <ProfileHeader user={profile.data} />
              </View>
            </View>
            {profile.data.bio ? <Text>{profile.data.bio}</Text> : null}
            <InterestChips interests={profile.data.interests} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                label="Message"
                style={{ flex: 1 }}
                onPress={() => router.push(`/chat/user:${id}`)}
              />
              <Button
                label={follow.isSuccess ? 'Requested' : 'Follow'}
                variant="secondary"
                style={{ flex: 1 }}
                loading={follow.isPending}
                disabled={follow.isSuccess}
                onPress={() => follow.mutate()}
              />
            </View>
            <Text variant="subheading">Posts</Text>
            {posts.isPending ? (
              <Loader />
            ) : posts.isError ? (
              <ErrorState onRetry={() => void posts.refetch()} />
            ) : posts.data?.length ? (
              posts.data.map((post) => <PostCard key={post.id} post={post} />)
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
