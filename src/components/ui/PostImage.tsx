import { spacing } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import type { PostMedia } from '@/features/feed/types';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

export function PostImage({
  image,
  locked,
  width = '100%',
  height = '100%',
  contentFit = 'contain',
  compact = false,
  onSize,
  onRetry,
}: {
  image: PostMedia;
  locked: boolean;
  width?: DimensionValue;
  height?: DimensionValue;
  contentFit?: 'contain' | 'cover';
  compact?: boolean;
  onSize?: (width: number, height: number) => void;
  onRetry?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const [failedUri, setFailedUri] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const failed = Boolean(image.uri && failedUri === image.uri);
  const cacheKey = `${image.id ?? image.uri}:${locked ? 'locked' : 'unlocked'}`;
  return (
    <View style={{ width, height, backgroundColor: theme.colors.surfaceElevated }}>
      <Image
        key={attempt}
        source={image.uri && !failed ? { uri: image.uri, cacheKey } : undefined}
        placeholder={image.blurhash ? { blurhash: image.blurhash } : undefined}
        recyclingKey={cacheKey}
        contentFit={contentFit}
        placeholderContentFit={contentFit}
        cachePolicy="memory-disk"
        accessibilityLabel={locked ? 'Locked premium image preview' : 'Post image'}
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) onSize?.(source.width, source.height);
        }}
        onError={() => setFailedUri(image.uri)}
        style={StyleSheet.absoluteFill}
      />
      {locked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Subscribe to view"
          onPress={() => router.push('/subscribe' as never)}
          style={[StyleSheet.absoluteFill, styles.lock]}
        >
          <Ionicons name="lock-closed" size={compact ? 20 : 28} color="white" />
          {!compact ? <Text style={styles.label}>Subscribe to view</Text> : null}
        </Pressable>
      ) : null}
      {locked && !compact && (failed || !image.uri) ? (
        <View style={styles.unavailable}>
          <Text variant="caption" style={{ color: 'white' }}>
            Preview unavailable
          </Text>
          {onRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry blurred preview"
              onPress={() => {
                setAttempt((value) => value + 1);
                setFailedUri(undefined);
                onRetry();
              }}
            >
              <Text style={styles.label}>Retry preview</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  lock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  label: { color: 'white', fontWeight: '600' },
  unavailable: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: spacing.sm,
  },
});
