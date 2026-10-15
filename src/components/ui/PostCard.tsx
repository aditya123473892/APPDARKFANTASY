import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Post, PostMedia } from '@/features/feed/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatRelativeTime } from '@/utils/formatters';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { RemoteMedia } from './RemoteMedia';
import { useAddComment, useComments, useDeleteComment } from '@/features/feed/hooks/useFeed';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { createClientId } from '@/utils/clientId';
import { Input } from './Input';
import { Button } from './Button';
import { Loader } from './Loader';

function RichText({ body }: { body: string }): React.JSX.Element {
  const chunks = body.split(/([#@][\w]+)/g);
  return (
    <>
      {chunks.map((chunk, index) => (
        <Text
          key={`${chunk}-${index}`}
          color={chunk.startsWith('#') || chunk.startsWith('@') ? 'primary' : 'default'}
        >
          {chunk}
        </Text>
      ))}
    </>
  );
}

/** Keeps any image size readable: aspect ratio is clamped between tall portrait and wide landscape. */
const clampAspect = (media: PostMedia): number =>
  Math.min(1.8, Math.max(0.8, media.width / media.height));

function MediaGallery({ media }: { media: PostMedia[] }): React.JSX.Element {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const aspect = clampAspect(media[0]!);
  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(Math.round(event.nativeEvent.layout.width));
  return (
    <View onLayout={onLayout} style={styles.mediaWrap}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={media.length > 1}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setActive(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          style={[styles.mediaScroller, { borderColor: theme.colors.border }]}
        >
          {media.map((item, index) => (
            <RemoteMedia
              key={`${item.uri}-${index}`}
              uri={item.uri}
              mimetype={item.mimetype}
              width={width}
              height={width / aspect}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ aspectRatio: aspect }} />
      )}
      {media.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Photo ${active + 1} of ${media.length}`}>
          {media.map((item, index) => (
            <View
              key={`${item.uri}-dot-${index}`}
              style={[
                styles.dot,
                { backgroundColor: index === active ? theme.colors.primary : theme.colors.border },
                index === active && styles.dotActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const COMMENT_MAX = 2000;

function Comments({ post }: { post: Post }): React.JSX.Element {
  const { theme } = useTheme();
  const me = useCurrentUserId();
  const [draft, setDraft] = useState('');
  // Reused if the same draft is resubmitted after a failure, so it is stored once.
  const pendingKey = useRef<{ text: string; clientId: string } | null>(null);
  const comments = useComments(post.id, true);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const rows = comments.data?.pages.flatMap((page) => page.comments) ?? [];

  const submit = () => {
    const text = draft.trim();
    if (!text || add.isPending) return;
    if (pendingKey.current?.text !== text)
      pendingKey.current = { text, clientId: createClientId() };
    const { clientId } = pendingKey.current;
    setDraft('');
    add.mutate(
      { content: text, clientId },
      {
        onSuccess: () => {
          pendingKey.current = null;
        },
        onError: () => setDraft((current) => current || text),
      },
    );
  };
  const confirmDelete = (commentId: string) =>
    Alert.alert('Delete this comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(commentId) },
    ]);

  return (
    <View style={styles.comments}>
      {comments.isPending ? (
        <Loader />
      ) : comments.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void comments.refetch()}>
          <Text color="danger" variant="caption">
            Couldn't load comments. Tap to retry.
          </Text>
        </Pressable>
      ) : rows.length ? (
        rows.map((item) => {
          const canDelete = !item.pending && (item.author.id === me || post.user.id === me);
          return (
            <View key={item.id} style={[styles.comment, item.pending && styles.pending]}>
              <View style={styles.commentCopy}>
                <Text variant="caption" weight="bold">
                  {item.author.name}
                  {item.createdAt ? (
                    <Text variant="caption" color="muted">
                      {'  '}
                      {item.pending ? 'Posting…' : formatRelativeTime(item.createdAt)}
                    </Text>
                  ) : null}
                </Text>
                <Text>{item.content}</Text>
              </View>
              {canDelete ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete comment"
                  hitSlop={8}
                  disabled={remove.isPending}
                  onPress={() => confirmDelete(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      ) : (
        <Text color="muted" variant="caption">
          No comments yet. Start the conversation.
        </Text>
      )}
      {comments.hasNextPage ? (
        <Button
          label={comments.isFetchingNextPage ? 'Loading…' : 'Show earlier comments'}
          variant="ghost"
          size="sm"
          disabled={comments.isFetchingNextPage}
          onPress={() => void comments.fetchNextPage()}
        />
      ) : null}
      <Input
        accessibilityLabel="Write a comment"
        placeholder="Write a comment"
        value={draft}
        onChangeText={setDraft}
        multiline
        maxLength={COMMENT_MAX}
      />
      <Button
        label="Comment"
        size="sm"
        loading={add.isPending}
        disabled={!draft.trim() || add.isPending}
        onPress={submit}
      />
    </View>
  );
}

export const PostCard = memo(function PostCard({
  post,
  onToggleLike,
  onOpenAuthor,
  onDelete,
}: {
  post: Post;
  onToggleLike?: (post: Post) => void;
  onOpenAuthor?: (post: Post) => void;
  /** Shown for the viewer's own posts. */
  onDelete?: (post: Post) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const scale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const long = post.body.length > 220;

  const like = (): void => {
    if (!onToggleLike || post.likeStateKnown === false) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.set(
      withSequence(
        withTiming(0.75, { duration: 80 }),
        withSpring(1, { damping: 8, stiffness: 240 }),
      ),
    );
    onToggleLike(post);
  };
  const share = (): void => {
    void Share.share({ message: `${post.user.name} on DARKFANTASY: “${post.body}”` });
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${post.user.name}'s profile`}
        disabled={!onOpenAuthor}
        onPress={() => onOpenAuthor?.(post)}
        style={styles.header}
      >
        <Avatar uri={post.user.avatarUri} label={post.user.name} size={42} />
        <View style={styles.headerCopy}>
          <View style={styles.nameRow}>
            <Text variant="label" numberOfLines={1} style={styles.name}>
              {post.user.name}
            </Text>
            {post.user.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={15}
                color={theme.colors.primary}
                accessibilityLabel="Verified"
              />
            ) : null}
          </View>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {post.user.handle ? `@${post.user.handle} · ` : ''}
            {formatRelativeTime(post.createdAt)}
            {post.audience === 'connections' ? ' · Connections' : ''}
            {post.audience === 'private' ? ' · Private' : ''}
            {post.status && post.status !== 'approved' ? ` · ${post.status}` : ''}
          </Text>
        </View>
      </Pressable>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete post"
          hitSlop={8}
          onPress={() =>
            Alert.alert('Delete this post?', 'Its likes and comments are removed too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
            ])
          }
          style={styles.delete}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}

      <Pressable
        disabled={!long || expanded}
        onPress={() => setExpanded(true)}
        accessibilityHint={long && !expanded ? 'Shows the full post' : undefined}
      >
        <Text numberOfLines={expanded ? undefined : 6}>
          <RichText body={post.body} />
        </Text>
        {long && !expanded ? (
          <Text variant="label" color="primary" style={styles.more}>
            Read more
          </Text>
        ) : null}
      </Pressable>

      {post.media?.length ? <MediaGallery media={post.media} /> : null}

      <View style={[styles.actions, { borderTopColor: theme.colors.divider }]}>
        <Animated.View style={likeStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.liked ? 'Unlike post' : 'Like post'}
            accessibilityState={{ selected: post.liked }}
            onPress={like}
            disabled={!onToggleLike || post.likeStateKnown === false}
            hitSlop={4}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons
              name={post.liked ? 'heart' : 'heart-outline'}
              size={21}
              color={post.liked ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text variant="label" weight="medium" color={post.liked ? 'primary' : 'secondary'}>
              {post.likes}
            </Text>
          </Pressable>
        </Animated.View>
        <Pressable
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={`${post.replies} comments`}
          onPress={() => setShowComments((shown) => !shown)}
        >
          <Ionicons name="chatbubble-outline" size={19} color={theme.colors.textMuted} />
          <Text variant="label" weight="medium" color="muted">
            {post.replies}
          </Text>
        </Pressable>
        <View style={styles.grow} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share post"
          onPress={share}
          hitSlop={4}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={20} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      {showComments ? <Comments post={post} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1 },
  more: { marginTop: spacing.xs },
  mediaWrap: { gap: spacing.sm },
  mediaScroller: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  dotActive: { width: 16 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.xs,
    paddingTop: spacing.xs,
  },
  action: {
    minHeight: spacing.touch - 4,
    minWidth: spacing.touch - 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  grow: { flex: 1 },
  delete: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  comments: { gap: spacing.md, paddingBottom: spacing.md },
  comment: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  commentCopy: { flex: 1, gap: spacing.xxs },
  pending: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
});
