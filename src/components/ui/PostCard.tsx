import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { memo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
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
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatRelativeTime } from '@/utils/formatters';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { PostImage } from './PostImage';
import { RemoteMedia } from './RemoteMedia';
import { useAddComment, useComments, useDeleteComment } from '@/features/feed/hooks/useFeed';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { useBlock } from '@/features/safety/useBlock';
import { createClientId } from '@/utils/clientId';
import { Button } from './Button';
import { Loader } from './Loader';
import { Badge } from './Badge';
import { ThreadLine } from './ThreadLine';

const AVATAR = 38;

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

/**
 * The frame follows the first photo's shape, clamped between 4:5 portrait and
 * 1.91:1 landscape. Photos are drawn with `contain`, so nothing is ever cropped;
 * anything outside that range is letterboxed instead.
 */
const clampAspect = (ratio: number): number => Math.min(1.91, Math.max(0.8, ratio));
const knownRatio = (media: PostMedia): number | undefined =>
  media.width > 0 && media.height > 0 ? media.width / media.height : undefined;

function MediaGallery({ media, locked, postId }: { media: PostMedia[]; locked: boolean; postId: string }): React.JSX.Element {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  // Legacy posts carry no size: measure the first image once it has loaded.
  const [measured, setMeasured] = useState<number>();
  const aspect = clampAspect(knownRatio(media[0]!) ?? measured ?? 1);
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
          style={[styles.mediaScroller, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          {media.map((item, index) => (
            item.mimetype?.startsWith('video/') ? (
              <RemoteMedia key={item.id || `${postId}:${index}`} uri={item.uri}
                mimetype={item.mimetype} locked={locked || item.locked}
                width={width} height={width / aspect} />
            ) : <PostImage
              key={item.id || `${postId}:${index}`}
              image={{ ...item, id: item.id || `${postId}:${index}` }}
              locked={locked}
              width={width}
              height={width / aspect}
              onSize={
                index === 0 && !knownRatio(item)
                  ? (w, h) => setMeasured(w / h)
                  : undefined
              }
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
  const router = useRouter();
  const me = useCurrentUserId();
  const [draft, setDraft] = useState('');
  // Reused if the same draft is resubmitted after a failure, so it is stored once.
  const pendingKey = useRef<{ text: string; clientId: string } | null>(null);
  const comments = useComments(post.id, true);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const rows = comments.data?.pages.flatMap((page) => page.comments) ?? [];
  const canSubmit = Boolean(draft.trim()) && !add.isPending;

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
      <View style={[styles.commentField, { backgroundColor: theme.colors.surfaceMuted }]}>
        <TextInput
          accessibilityLabel="Write a comment"
          placeholder="Add a reply…"
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          maxFontSizeMultiplier={typography.maxFontScale}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={COMMENT_MAX}
          style={[styles.commentInput, { color: theme.colors.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comment"
          accessibilityState={{ disabled: !canSubmit, busy: add.isPending }}
          disabled={!canSubmit}
          onPress={submit}
          hitSlop={6}
          style={[
            styles.commentSend,
            { backgroundColor: canSubmit ? theme.colors.primary : theme.palette.transparent },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color={canSubmit ? theme.colors.onPrimary : theme.colors.textMuted}
          />
        </Pressable>
      </View>
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
              <Avatar uri={item.author.avatarUri} label={item.author.name} size={26} />
              <View style={styles.commentCopy}>
                <Text variant="label" numberOfLines={1}>
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
                  hitSlop={10}
                  disabled={remove.isPending}
                  onPress={() => confirmDelete(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
              {!item.pending && item.author.id !== me ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Report ${item.author.name}'s comment`}
                  hitSlop={10}
                  onPress={() =>
                    router.push({
                      pathname: '/report' as never,
                      params: { targetType: 'comment', targetId: item.id },
                    })
                  }
                >
                  <Ionicons name="flag-outline" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      ) : (
        <Text color="muted" variant="caption">
          No replies yet. Start the conversation.
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
    </View>
  );
}

/** Icon + optional count. Zero counts are hidden to keep the row quiet. */
function Action({
  icon,
  count,
  color,
  label,
  selected,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  color: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? { disabled } : { selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.action,
        pressed && { backgroundColor: theme.colors.surfacePressed },
      ]}
    >
      <Ionicons name={icon} size={21} color={color} />
      {count ? (
        <Text variant="label" weight="medium" style={{ color }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
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
  const router = useRouter(), me = useCurrentUserId();
  const block = useBlock();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const scale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const long = post.body.length > 280;
  const meta = [
    post.user.handle ? `@${post.user.handle}` : null,
    post.audience === 'connections' ? 'Connections' : null,
    post.audience === 'private' ? 'Private' : null,
    post.status && post.status !== 'approved' ? post.status : null,
  ].filter(Boolean);

  const like = (): void => {
    if (!onToggleLike || post.likeStateKnown === false) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.set(
      withSequence(
        withTiming(0.7, { duration: 80 }),
        withSpring(1, { damping: 7, stiffness: 260 }),
      ),
    );
    onToggleLike(post);
  };
  const share = (): void => {
    if (post.locked) return;
    void Share.share({ message: `${post.user.name} on DARKFANTASY: “${post.body}”` });
  };
  const openAuthor = onOpenAuthor ? () => onOpenAuthor(post) : undefined;

  return (
    <View style={[styles.card, { borderBottomColor: theme.colors.divider }]}>
      <View style={styles.avatarColumn}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${post.user.name}'s profile`}
          disabled={!openAuthor}
          onPress={openAuthor}
        >
          <Avatar uri={post.user.avatarUri} label={post.user.name} size={AVATAR} />
        </Pressable>
        {showComments ? <ThreadLine /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${post.user.name}'s profile`}
            disabled={!openAuthor}
            onPress={openAuthor}
            hitSlop={{ top: 8, bottom: 4 }}
            style={styles.author}
          >
            <Text variant="label" numberOfLines={1} style={styles.name}>
              {post.user.name}
            </Text>
            {post.user.verified ? <Badge variant="verified" /> : null}
          </Pressable>
          <Text variant="caption" color="muted" style={styles.time}>
            {formatRelativeTime(post.createdAt)}
          </Text>
          {post.user.id !== me ? <Pressable accessibilityRole="button" accessibilityLabel="Post options" hitSlop={10} style={styles.more}
            onPress={() => Alert.alert('Post options', undefined, [
              { text: 'Report post', onPress: () => router.push({ pathname: '/report' as never, params: { targetType: 'post', targetId: post.id } }) },
              { text: `Block ${post.user.name}`, style: 'destructive', onPress: () => block.confirm(post.user.id) },
              { text: 'Cancel', style: 'cancel' },
            ])}><Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} /></Pressable> : null}
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete post"
              hitSlop={10}
              onPress={() =>
                Alert.alert('Delete this post?', 'Its likes and comments are removed too.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
                ])
              }
              style={styles.more}
            >
              <Ionicons name="trash-outline" size={17} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {meta.length ? (
          <Text variant="caption" color="muted" numberOfLines={1} style={styles.meta}>
            {meta.join(' · ')}
          </Text>
        ) : null}

        {post.body ? (
          <Pressable
            disabled={!long || expanded}
            onPress={() => setExpanded(true)}
            accessibilityHint={long && !expanded ? 'Shows the full post' : undefined}
            style={styles.text}
          >
            <Text numberOfLines={expanded ? undefined : 8}>
              <RichText body={post.body} />
            </Text>
            {long && !expanded ? (
              <Text variant="label" color="muted" style={styles.readMore}>
                Read more
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {post.contentVisibility === 'premium' && post.user.id === me ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Badge variant="premium" /><Text variant="caption">Premium</Text>
          </View>
        ) : null}
        {post.media?.length ? <MediaGallery media={post.media} locked={post.locked === true} postId={post.id} /> : null}

        <View style={styles.actions}>
          <Animated.View style={likeStyle}>
            <Action
              icon={post.liked ? 'heart' : 'heart-outline'}
              count={post.likes}
              color={post.liked ? theme.colors.primary : theme.colors.textSecondary}
              label={`${post.liked ? 'Unlike post' : 'Like post'}. ${post.likes} likes`}
              selected={post.liked}
              disabled={!onToggleLike || post.likeStateKnown === false}
              onPress={like}
            />
          </Animated.View>
          <Action
            icon={showComments ? 'chatbubble' : 'chatbubble-outline'}
            count={post.replies}
            color={showComments ? theme.colors.primaryText : theme.colors.textSecondary}
            label={`${post.replies} comments. ${showComments ? 'Hide' : 'Show'} comments`}
            onPress={() => setShowComments((shown) => !shown)}
          />
          <Action
            icon="paper-plane-outline"
            color={theme.colors.textSecondary}
            label="Share post"
            disabled={post.locked === true}
            onPress={share}
          />
        </View>
        {showComments ? <Comments post={post} /> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarColumn: { width: AVATAR, alignItems: 'center', paddingBottom: spacing.md },
  body: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: 22 },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  name: { flexShrink: 1 },
  time: { flex: 1 },
  more: { marginLeft: 'auto', padding: spacing.xxs },
  meta: { marginTop: 1 },
  text: { marginTop: spacing.xs },
  readMore: { marginTop: spacing.xxs },
  mediaWrap: { gap: spacing.sm, marginTop: spacing.sm + 2 },
  mediaScroller: { borderRadius: radius.md, overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: radius.full },
  dotActive: { width: 16 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.sm,
    marginTop: spacing.xs,
  },
  action: {
    minHeight: 40,
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  comments: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md },
  commentField: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: radius.input,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  commentInput: {
    flex: 1,
    minHeight: 32,
    maxHeight: 120,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily,
  },
  commentSend: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'flex-start' },
  commentCopy: { flex: 1, gap: spacing.xxs },
  pending: { opacity: 0.6 },
});
