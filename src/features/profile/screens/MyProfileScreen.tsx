import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import {
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Modal,
  PostCard,
  Skeleton,
  Tabs,
  Text,
} from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useConversations } from '@/features/chat/hooks/useChat';
import { useMyPosts, useToggleLike } from '@/features/feed/hooks/useFeed';
import { useQuery } from '@tanstack/react-query';
import { getData } from '@/services/api/backend';
import { ErrorState } from '@/components/feedback/ErrorState';
import type { Post } from '@/features/feed/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { toHandle } from '@/utils/formatters';
import { EditProfileForm } from '../components/EditProfileForm';
import { InterestChips } from '../components/InterestChips';
import { PhotoGrid } from '../components/PhotoGrid';
import { ProfileHeader } from '../components/ProfileHeader';

type ProfileTab = 'Posts' | 'Photos';

function Stat({ value, label }: { value: number | undefined; label: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      {value === undefined ? (
        <Skeleton style={styles.statSkeleton} />
      ) : (
        <Text variant="heading">{value}</Text>
      )}
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

export function MyProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('Posts');
  const feed = useMyPosts();
  const followers = useQuery({
    queryKey: ['followers'],
    queryFn: () => getData<{ followers: unknown[] }>('/users/follow/followers'),
  });
  const conversations = useConversations();
  const toggleLike = useToggleLike();

  const myPosts = useMemo(
    () => feed.data?.filter((post) => post.user.id === user?.id),
    [feed.data, user?.id],
  );
  const onToggleLike = useCallback(
    (post: Post) => toggleLike.mutate({ postId: post.id, liked: !post.liked }),
    [toggleLike],
  );

  if (!user) return <Screen>{null}</Screen>;
  const photos = user.photos?.length ? user.photos : [user.avatarUri];

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              void feed.refetch();
              void conversations.refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surfaceElevated}
          />
        }
      >
        <View style={styles.padded}>
          <Header
            title="Profile"
            align="left"
            action={
              <IconButton
                icon="settings-outline"
                label="Settings"
                onPress={() => router.push('/settings')}
              />
            }
          />
          <View style={styles.identity}>
            <Avatar uri={user.avatarUri} label={`${user.name}'s photo`} size={96} ring />
            <View style={styles.identityCopy}>
              <ProfileHeader user={user} />
              <Text variant="caption" color="muted">
                @{toHandle(user.name)}
              </Text>
            </View>
          </View>
          <Text style={styles.bio}>{user.bio}</Text>
          <View style={styles.stats}>
            <Stat value={myPosts?.length} label="Posts" />
            <Stat value={followers.data?.followers.length} label="Followers" />
            <Stat value={user.interests.length} label="Interests" />
          </View>
          <View style={styles.buttons}>
            <Button
              label="Edit profile"
              icon="create-outline"
              size="sm"
              onPress={() => setEditing(true)}
              style={styles.button}
            />
            <Button
              label="Share"
              icon="share-social-outline"
              variant="secondary"
              size="sm"
              onPress={() => {
                void Share.share({ message: `Meet ${user.name} on DARKFANTASY.` });
              }}
              style={styles.button}
            />
          </View>
          <View style={styles.section}>
            <Text variant="label" color="muted">
              INTERESTS
            </Text>
            <InterestChips interests={user.interests} />
          </View>
        </View>

        <View style={styles.tabs}>
          <Tabs items={['Posts', 'Photos'] as const} value={tab} onChange={setTab} />
        </View>
        <View style={styles.padded}>
          {tab === 'Photos' ? (
            <PhotoGrid photos={photos} name={user.name} />
          ) : feed.isPending ? (
            <Skeleton style={styles.postSkeleton} />
          ) : feed.isError ? (
            <ErrorState onRetry={() => void feed.refetch()} />
          ) : myPosts?.length ? (
            <View style={styles.posts}>
              {myPosts.map((post) => (
                <PostCard key={post.id} post={post} onToggleLike={onToggleLike} />
              ))}
            </View>
          ) : (
            <EmptyState
              compact
              icon="create-outline"
              title="No posts yet"
              message="Share a thought — it helps people get a feel for who you are."
              actionLabel="Write a post"
              onAction={() => router.push('/create')}
            />
          )}
        </View>
      </ScrollView>
      <Modal visible={editing} title="Edit profile" onClose={() => setEditing(false)}>
        <EditProfileForm user={user} onDone={() => setEditing(false)} />
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  padded: { paddingHorizontal: spacing.screen },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.md },
  identityCopy: { flex: 1, gap: spacing.xs },
  bio: { paddingTop: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  statSkeleton: { width: 28, height: 26 },
  buttons: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg },
  button: { flex: 1 },
  section: { gap: spacing.sm, paddingTop: spacing.xl },
  tabs: { paddingTop: spacing.xl, paddingBottom: spacing.lg },
  posts: { gap: spacing.md },
  postSkeleton: { height: 160, borderRadius: radius.lg },
});
