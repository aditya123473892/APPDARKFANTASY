import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Screen, Header } from '@/components/layout';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostList } from '@/components/ui/PostList';
import { PostImage } from '@/components/ui/PostImage';
import type { Post } from '@/features/feed/types';
import {
  durationLabel,
  isVideo,
  mediaCacheKey,
  mediaPreviews,
  singleMedia,
  usePostPresentation,
} from '@/features/feed/presentation';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** Tiles mounted at first, and added each time the profile is scrolled near its end. */
const GRID_STEP = 30;
/** How close to the bottom (in points) the next tiles are added. */
const GRID_THRESHOLD = 800;

/**
 * Grows the number of grid tiles as the profile's ScrollView nears its end, so a profile
 * with hundreds of posts does not mount (and download) every image at once. Pass
 * `onScroll` to the ScrollView (with scrollEventThrottle) and `limit` to ProfileGrid.
 */
export function useGridWindow() {
  const [limit, setLimit] = useState(GRID_STEP);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - GRID_THRESHOLD)
      setLimit((value) => value + GRID_STEP);
  }, []);
  return { limit, onScroll };
}

const GridTile = memo(function GridTile({
  post,
  index,
  size,
  onOpen,
}: {
  post: Post;
  index: number;
  size: number;
  onOpen: (index: number) => void;
}) {
  const { theme } = useTheme();
  const media = singleMedia(post);
  const video = isVideo(media);
  const preview = mediaPreviews.get(media?.uri ?? '');
  const locked = Boolean(post.locked || media?.locked);
  const thumbnail = !video && media?.thumbnailUri;
  // The same key as the feed for originals, so photos already seen there are reused.
  const gridKey = media ? `${mediaCacheKey(media)}${thumbnail ? ':thumb' : ''}` : undefined;
  const uri = video ? preview?.thumbnail : thumbnail || media?.uri;
  if (locked && media && !video)
    return <PostImage image={media} locked compact width={size} height={size} contentFit="cover" />;
  return (
    <Pressable
      accessibilityLabel={`Open ${video ? 'video' : 'image'} post by ${post.user.name}`}
      onPress={() => onOpen(index)}
      style={{
        width: size,
        height: size,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      {!locked && media && uri ? (
        <Image
          // The same key as the feed, so photos already seen there are not downloaded again.
          source={video ? { uri } : { uri, cacheKey: gridKey }}
          recyclingKey={video ? uri : gridKey}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
      {locked ? (
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={theme.colors.textMuted}
          style={{ position: 'absolute', top: 8, right: 8 }}
        />
      ) : video ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#00000080',
            padding: 4,
          }}
        >
          <Ionicons name="play" color="white" size={12} />
          {preview?.duration ? (
            <Text variant="caption" weight="regular" style={{ color: 'white' }}>
              {durationLabel(preview.duration)}
            </Text>
          ) : null}
        </View>
      ) : (post.media?.length ?? 0) > 1 ? (
        <Ionicons
          name="copy"
          size={20}
          color="white"
          style={{ position: 'absolute', top: 8, right: 8 }}
        />
      ) : null}
    </Pressable>
  );
});

export function ProfileGrid({
  posts,
  onToggleLike,
  onDelete,
  showSaved = true,
  limit = Infinity,
}: {
  posts: Post[];
  onToggleLike?: (post: Post) => void;
  onDelete?: (post: Post) => void;
  showSaved?: boolean;
  /** How many tiles to mount; see useGridWindow. Defaults to all. */
  limit?: number;
}) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [tab, setTab] = useState<'grid' | 'saved'>('grid');
  const [selected, setSelected] = useState<{ posts: Post[]; title: string }>();
  const saved = usePostPresentation((state) => state.saved);
  const displayed = useMemo(
    () => (tab === 'saved' ? Object.values(saved) : posts),
    [tab, saved, posts],
  );
  const size = (Math.min(width, spacing.contentMax) - 4) / 3;
  const open = useCallback(
    (index: number) =>
      setSelected({
        posts: [...displayed.slice(index), ...displayed.slice(0, index)],
        title: tab === 'grid' ? 'Posts' : 'Saved',
      }),
    [displayed, tab],
  );
  // The opened posts, kept current with likes and deletions; indexed once instead of a
  // scan per post on every render.
  const opened = useMemo(() => {
    if (!selected) return [];
    const current = new Map(posts.map((post) => [post.id, post]));
    return selected.posts
      .filter((post) =>
        selected.title === 'Posts' ? current.has(post.id) : Boolean(saved[post.id]),
      )
      .map((post) => current.get(post.id) ?? saved[post.id] ?? post);
  }, [selected, posts, saved]);
  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: spacing.lg, marginBottom: 2 }}>
        {(['grid', ...(showSaved ? ['saved'] : [])] as ('grid' | 'saved')[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={value === 'grid' ? 'Posts grid' : 'Saved posts'}
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              borderBottomWidth: 2,
              borderBottomColor: tab === value ? theme.colors.primary : 'transparent',
            }}
          >
            <Ionicons
              name={value === 'grid' ? 'grid-outline' : 'bookmark-outline'}
              size={24}
              color={tab === value ? theme.colors.text : theme.colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {displayed.slice(0, limit).map((post, index) => (
          <GridTile key={post.id} post={post} index={index} size={size} onOpen={open} />
        ))}
      </View>
      {!displayed.length ? (
        <EmptyState
          compact
          icon={tab === 'grid' ? 'camera-outline' : 'bookmark-outline'}
          title={tab === 'grid' ? 'No posts yet' : 'Save what inspires you'}
          message={
            tab === 'grid'
              ? 'Your moments will appear here.'
              : 'Tap the bookmark on a post to find it here.'
          }
        />
      ) : null}
      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(undefined)}
      >
        <Screen padded={false}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Header title={selected?.title ?? 'Posts'} back onBack={() => setSelected(undefined)} />
          </View>
          {selected ? (
            <PostList posts={opened} onToggleLike={onToggleLike} onDelete={onDelete} />
          ) : null}
        </Screen>
      </Modal>
    </View>
  );
}
