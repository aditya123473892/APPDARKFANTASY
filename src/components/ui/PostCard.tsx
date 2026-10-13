import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import {
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
            <Image
              key={`${item.uri}-${index}`}
              source={{ uri: item.uri }}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              accessibilityLabel={`Post photo ${index + 1} of ${media.length}`}
              style={{ width, aspectRatio: aspect, backgroundColor: theme.colors.surfaceElevated }}
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

export const PostCard = memo(function PostCard({
  post,
  onToggleLike,
  onOpenAuthor,
}: {
  post: Post;
  onToggleLike?: (post: Post) => void;
  onOpenAuthor?: (post: Post) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const scale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const long = post.body.length > 220;

  const like = (): void => {
    if (!onToggleLike) return;
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
            @{post.user.handle} · {formatRelativeTime(post.createdAt)}
            {post.audience === 'connections' ? ' · Connections' : ''}
          </Text>
        </View>
      </Pressable>

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
        <View style={styles.action} accessibilityLabel={`${post.replies} replies`}>
          <Ionicons name="chatbubble-outline" size={19} color={theme.colors.textMuted} />
          <Text variant="label" weight="medium" color="muted">
            {post.replies}
          </Text>
        </View>
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
  pressed: { opacity: 0.6 },
});
