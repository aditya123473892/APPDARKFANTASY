import { useState } from 'react';
import { RefreshControl, ScrollView, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Header, Screen, SettingsButton } from '@/components/layout';
import { Button, Loader, Modal } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDeletePost, useMyPosts, useToggleLike } from '@/features/feed/hooks/useFeed';
import { getData } from '@/services/api/backend';
import { toHandle } from '@/utils/formatters';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { EditProfileForm } from '../components/EditProfileForm';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileGrid } from '../components/ProfileGrid';

export function MyProfileScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [editing, setEditing] = useState(false);
  const feed = useMyPosts();
  const followers = useQuery({
    queryKey: ['followers'],
    queryFn: () => getData<{ followers: unknown[] }>('/users/follow/followers'),
  });
  const following = useQuery({
    queryKey: ['following'],
    queryFn: () => getData<{ following: unknown[] }>('/users/follow/following'),
  });
  const toggle = useToggleLike();
  const remove = useDeletePost();
  if (!user)
    return (
      <Screen>
        <Loader />
      </Screen>
    );
  const posts = feed.data?.filter((post) => post.user.id === user.id) ?? [];
  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              void feed.refetch();
              void followers.refetch();
              void following.refetch();
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
            followers={followers.data?.followers.length}
            following={following.data?.following.length}
          />
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
