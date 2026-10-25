import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { useBlock } from '@/features/safety/useBlock';
import type { Post } from '@/features/feed/types';
import { mediaPreviews, singleMedia, usePostPresentation } from '@/features/feed/presentation';
import { formatRelativeTime } from '@/utils/formatters';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Avatar } from './Avatar';
import { CommentsSheet } from './CommentsSheet';
import { LikesSheet } from './LikesSheet';
import { PostActions } from './PostActions';
import { PostCarousel } from './PostCarousel';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useRefreshPost } from '@/features/feed/hooks/useFeed';

export const PostCard = memo(function PostCard({
  post,
  onToggleLike,
  onOpenAuthor,
  onDelete,
  active = false,
}: {
  post: Post;
  onToggleLike?: (post: Post) => void;
  onOpenAuthor?: (post: Post) => void;
  onDelete?: (post: Post) => void;
  active?: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const me = useCurrentUserId();
  const block = useBlock();
  const refresh = useRefreshPost();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [comments, setComments] = useState(false);
  const [likes, setLikes] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [localLiked, setLocalLiked] = useState(post.liked);
  const saved = usePostPresentation((state) => Boolean(state.saved[post.id]));
  const toggleSaved = usePostPresentation((state) => state.toggleSaved);
  const media = singleMedia(post);
  const liked = onToggleLike ? post.liked : localLiked;
  const count =
    post.likes + (!onToggleLike && localLiked !== post.liked ? (localLiked ? 1 : -1) : 0);
  const disabled = post.likeStateKnown === false;
  const like = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (onToggleLike) onToggleLike(post);
    else setLocalLiked(!localLiked);
  };
  const username = post.user.handle || post.user.name;
  const link = `darkfantasy://post/${post.id}`;
  if (hidden) return null;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View
        style={{
          height: 56,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          accessibilityLabel={`View ${username}'s profile`}
          onPress={() =>
            onOpenAuthor
              ? onOpenAuthor(post)
              : router.push(post.user.id === me ? '/profile' : `/profile/${post.user.id}`)
          }
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Avatar uri={post.user.avatarUri} label={post.user.name} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14 }}>
              {username}
            </Text>
            {mediaPreviews.get(media?.uri ?? '')?.location ||
            (post.status && post.status !== 'approved') ? (
              <Text variant="caption" weight="regular" color="muted" numberOfLines={1}>
                {mediaPreviews.get(media?.uri ?? '')?.location || post.status}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel="Post menu"
          onPress={() =>
            Alert.alert('Post options', undefined, [
              { text: 'Copy link', onPress: () => void Clipboard.setStringAsync(link) },
              { text: 'Hide post', onPress: () => setHidden(true) },
              ...(post.user.id !== me
                ? [
                    {
                      text: 'Report post',
                      onPress: () =>
                        router.push({
                          pathname: '/report' as never,
                          params: { targetType: 'post', targetId: post.id },
                        }),
                    },
                    {
                      text: 'Block user',
                      style: 'destructive' as const,
                      onPress: () => block.confirm(post.user.id),
                    },
                  ]
                : []),
              ...(onDelete && post.user.id === me
                ? [
                    {
                      text: 'Delete post',
                      style: 'destructive' as const,
                      onPress: () =>
                        Alert.alert('Delete this post?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
                        ]),
                    },
                  ]
                : []),
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
        </Pressable>
      </View>
      {media ? (
        <PostCarousel
          key={post.id}
          items={post.media ?? []}
          locked={post.locked}
          active={active && !comments && !likes}
          onRetry={() => {
            if (!refresh.isPending) refresh.mutate(post.id);
          }}
          onDoubleTap={() => {
            if (!liked) like();
          }}
        />
      ) : null}
      <PostActions
        liked={liked}
        saved={saved}
        onLike={like}
        likeDisabled={disabled}
        onComment={() => setComments(true)}
        onSave={() => toggleSaved(post)}
        onShare={() => {
          if (!post.locked)
            void Share.share({ message: `${post.user.name}: ${post.body}\n${link}` });
        }}
      />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.xs }}>
        <Pressable
          accessibilityLabel={`${count} likes. View likes`}
          onPress={() => setLikes(true)}
          style={{ justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text
            weight="semibold"
            style={{ fontSize: 14, fontVariant: ['tabular-nums'], minWidth: 100 }}
          >
            {count.toLocaleString()} likes
          </Text>
        </Pressable>
        <Text
          numberOfLines={expanded ? undefined : 2}
          onTextLayout={(event) => {
            if (!expanded && event.nativeEvent.lines.length > 2) setTruncated(true);
          }}
          style={{ fontSize: 14 }}
        >
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {username}{' '}
          </Text>
          {post.body}
        </Text>
        {!expanded && (truncated || post.body.length > 100) ? (
          <Pressable
            accessibilityLabel="Read full caption"
            onPress={() => setExpanded(true)}
            style={{ justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Text color="muted" style={{ fontSize: 14 }}>
              more
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="View all comments"
          onPress={() => setComments(true)}
          style={{ justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text color="muted" style={{ fontSize: 14 }}>
            View all {post.replies} comments
          </Text>
        </Pressable>
        <Text variant="caption" weight="regular" color="muted">
          {formatRelativeTime(post.createdAt)}
        </Text>
      </View>
      {comments ? <CommentsSheet post={post} visible onClose={() => setComments(false)} /> : null}
      {likes ? <LikesSheet visible onClose={() => setLikes(false)} /> : null}
    </View>
  );
});
