import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { Post, PostMedia } from '@/features/feed/types';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { createVideoThumbnail } from '@/features/create-post/videoThumbnail';
import {
  durationLabel,
  isVideo,
  mediaCacheKey,
  mediaPreviews,
  previewKey,
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
export function useGridWindow(total = Infinity) {
  const [limit, setLimit] = useState(GRID_STEP);
  const grownAt = useRef(-1);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      // Once per content height (the added tiles change it) and only while posts remain;
      // growing on every scroll event re-rendered the whole profile near the bottom.
      if (contentSize.height === grownAt.current) return;
      if (layoutMeasurement.height + contentOffset.y < contentSize.height - GRID_THRESHOLD) return;
      grownAt.current = contentSize.height;
      setLimit((value) => (value < total ? value + GRID_STEP : value));
    },
    [total],
  );
  return { limit, onScroll };
}

/**
 * Video tiles get a frame made on the device: the server has no poster images, so they
 * showed an empty square unless that video had played in the feed this session. At most
 * two are made at once, and one per video is shared by every tile and the feed.
 */
const framing = new Map<string, Promise<string>>();
let framesRunning = 0;
const framesWaiting: (() => void)[] = [];
async function oneOfTwo<T>(task: () => Promise<T>): Promise<T> {
  if (framesRunning >= 2) await new Promise<void>((resolve) => framesWaiting.push(resolve));
  framesRunning++;
  try {
    return await task();
  } finally {
    framesRunning--;
    framesWaiting.shift()?.();
  }
}
function videoFrame(media: PostMedia): Promise<string> {
  const key = previewKey(media);
  const known = mediaPreviews.get(key)?.thumbnail;
  if (known) return Promise.resolve(known);
  let pending = framing.get(key);
  if (!pending) {
    const scope = sessionIdentity.generation;
    pending = oneOfTwo(() => createVideoThumbnail(media.uri))
      .then((uri) => {
        // Never hand one account's frame to the next session.
        if (scope === sessionIdentity.generation)
          mediaPreviews.set(key, { ...mediaPreviews.get(key), thumbnail: uri });
        return uri;
      })
      .finally(() => framing.delete(key));
    framing.set(key, pending);
  }
  return pending;
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
  const preview = mediaPreviews.get(previewKey(media));
  const locked = Boolean(post.locked || media?.locked);
  const thumbnail = !video && media?.thumbnailUri;
  // The same key as the feed for originals, so photos already seen there are reused.
  const gridKey = media ? `${mediaCacheKey(media)}${thumbnail ? ':thumb' : ''}` : undefined;
  const [frame, setFrame] = useState<{ key: string; uri: string }>();
  const needsFrame = video && !locked && Boolean(media?.uri) && !preview?.thumbnail;
  useEffect(() => {
    if (!needsFrame || !media) return;
    let alive = true;
    const key = previewKey(media);
    void videoFrame(media)
      .then((uri) => {
        if (alive) setFrame({ key, uri });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [needsFrame, media]);
  const ownFrame = frame?.key === previewKey(media) ? frame.uri : undefined;
  const uri = video ? (preview?.thumbnail ?? ownFrame) : thumbnail || media?.uri;
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
