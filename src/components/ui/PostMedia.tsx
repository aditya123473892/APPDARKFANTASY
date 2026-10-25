import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import type { PostMedia as Media } from '@/features/feed/types';
import { durationLabel, isVideo, mediaPreviews, postRatio } from '@/features/feed/presentation';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Skeleton } from './Skeleton';
import { createVideoThumbnail } from '@/features/create-post/videoThumbnail';
import { useRouter } from 'expo-router';
import { useEvent } from 'expo';

function ActiveVideo({
  media,
  onDoubleTap,
  onRetry,
}: {
  media: Media;
  onDoubleTap: () => void;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(mediaPreviews.get(media.uri)?.duration ?? 0);
  const [retryError, setRetryError] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef(0);
  const player = useVideoPlayer({ uri: media.uri }, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying: playing } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEffect(() => {
    const state = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'readyToPlay') setDuration(player.duration);
    });
    const progress = player.addListener('timeUpdate', ({ currentTime }) => setTime(currentTime));
    return () => {
      state.remove();
      progress.remove();
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, [player]);
  const retry = () => {
    onRetry?.();
    setRetryError(false);
    void player
      .replaceAsync({ uri: media.uri })
      .then(() => player.play())
      .catch(() => setRetryError(true));
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      onDoubleTap();
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => (player.playing ? player.pause() : player.play()), 280);
    }
  };
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {status === 'error' || retryError ? (
        <Pressable accessibilityLabel="Retry video" onPress={retry} style={styles.center}>
          <Text>Tap to retry</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel={`${playing ? 'Pause video' : 'Play video'}. Double tap to like`}
          onPress={tap}
          style={styles.center}
        >
          {!playing ? <Ionicons name="play" size={48} color="white" /> : null}
        </Pressable>
      )}
      {status === 'loading' ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.duration, { backgroundColor: theme.colors.overlayStrong }]}
      >
        <Text variant="caption" weight="regular" style={{ color: 'white' }}>
          {durationLabel(duration)}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        accessibilityState={{ selected: !muted }}
        onPress={() => {
          // expo-video exposes this native player setting as an imperative setter.
          // eslint-disable-next-line react-hooks/immutability
          player.muted = !muted;
          setMuted(!muted);
        }}
        style={[styles.mute, { backgroundColor: theme.colors.overlayStrong }]}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="white" />
      </Pressable>
      <View pointerEvents="none" style={styles.track}>
        <View
          style={{
            height: 2,
            width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%`,
            backgroundColor: theme.colors.primary,
          }}
        />
      </View>
    </View>
  );
}

/** Only the visible video mounts a player; useVideoPlayer releases it on unmount. */
export function PostMedia({
  media,
  active = false,
  locked = false,
  onDoubleTap,
  ratio,
  onRetry,
}: {
  media?: Media;
  active?: boolean;
  locked?: boolean;
  onDoubleTap?: () => void;
  ratio?: number;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const [loadedUri, setLoadedUri] = useState<string>();
  const [failedUri, setFailedUri] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [thumbnail, setThumbnail] = useState<{ source: string; uri: string }>();
  const [heart] = useState(() => new Animated.Value(0));
  const lastTap = useRef(0);
  const video = isVideo(media);
  const preview = mediaPreviews.get(media?.uri ?? '');
  const thumbnailUri =
    preview?.thumbnail ?? (thumbnail?.source === media?.uri ? thumbnail?.uri : undefined);
  const loaded = Boolean(media?.uri && loadedUri === media.uri);
  const failed = Boolean(media?.uri && failedUri === media.uri);
  useEffect(() => {
    if (!media || !video || !active || locked || media.locked || preview?.thumbnail) return;
    let cancelled = false;
    void createVideoThumbnail(media.uri)
      .then((uri) => {
        mediaPreviews.set(media.uri, { ...mediaPreviews.get(media.uri), thumbnail: uri });
        if (!cancelled) setThumbnail({ source: media.uri, uri });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [media, video, active, locked, preview?.thumbnail]);
  const pop = () => {
    if (!onDoubleTap) return;
    onDoubleTap?.();
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, useNativeDriver: true }),
      Animated.delay(450),
      Animated.timing(heart, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };
  const tapImage = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      pop();
      lastTap.current = 0;
    } else lastTap.current = now;
  };
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: ratio ?? postRatio(media),
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      {locked || media?.locked ? (
        <Pressable
          accessibilityLabel="Subscribe to view media"
          onPress={() => router.push('/subscribe')}
          style={styles.center}
        >
          <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
          <Text color="muted">Subscribe to view</Text>
        </Pressable>
      ) : media && !media.uri ? (
        <Pressable
          accessibilityLabel={`${video ? 'Video' : 'Photo'} unavailable. Tap to refresh post`}
          onPress={onRetry}
          style={styles.center}
        >
          <Ionicons
            name={video ? 'videocam-outline' : 'image-outline'}
            size={32}
            color={theme.colors.textMuted}
          />
          <Text color="muted">{video ? 'Video unavailable' : 'Photo unavailable'}</Text>
          <Text variant="caption" color="muted">
            Tap to refresh
          </Text>
        </Pressable>
      ) : (
        <>
          {!loaded && !failed && (!video || thumbnailUri) ? (
            <Skeleton style={StyleSheet.absoluteFill} />
          ) : null}
          {media && (!video || thumbnailUri) ? (
            <Image
              key={attempt}
              source={{ uri: video ? thumbnailUri : media.uri }}
              placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setLoadedUri(media.uri)}
              onError={() => setFailedUri(media.uri)}
              style={StyleSheet.absoluteFill}
              recyclingKey={media.uri}
            />
          ) : null}
          {video && media ? (
            active ? (
              <ActiveVideo key={media.uri} media={media} onDoubleTap={pop} onRetry={onRetry} />
            ) : (
              <Pressable
                accessibilityLabel={
                  onDoubleTap ? 'Video preview. Double tap to like' : 'Selected video preview'
                }
                onPress={tapImage}
                style={styles.center}
              >
                <Ionicons name="play-circle" size={56} color="white" />
                {preview?.duration ? (
                  <View style={[styles.duration, { backgroundColor: theme.colors.overlayStrong }]}>
                    <Text variant="caption" weight="regular" style={{ color: 'white' }}>
                      {durationLabel(preview.duration)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            )
          ) : null}
          {!video ? (
            <Pressable
              accessibilityLabel={
                failed
                  ? 'Tap to retry image'
                  : onDoubleTap
                    ? 'Post image. Double tap to like'
                    : 'Selected image preview'
              }
              onPress={() => {
                if (failed) {
                  setAttempt((n) => n + 1);
                  setFailedUri(undefined);
                  onRetry?.();
                } else tapImage();
              }}
              style={styles.center}
            >
              {failed ? (
                <Text>Tap to retry</Text>
              ) : !media ? (
                <Text color="muted">Media unavailable</Text>
              ) : null}
            </Pressable>
          ) : null}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.center,
              {
                opacity: heart,
                transform: [
                  { scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) },
                ],
              },
            ]}
          >
            <Ionicons name="heart" size={88} color="white" />
          </Animated.View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  duration: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mute: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '100%',
    backgroundColor: '#ffffff40',
  },
});
