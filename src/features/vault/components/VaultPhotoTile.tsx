import { radius, spacing } from '@/theme';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { FitImage } from '@/components/ui/FitImage';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { photoUri } from '../media';
import type { VaultPhoto } from '../types';

export function VaultPhotoTile({
  owner,
  photo,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  owner: string;
  photo: VaultPhoto;
  selected: boolean;
  selecting: boolean;
  onPress: () => void;
  onLongPress: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [uri, setUri] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastAttempt = useRef(0);
  const video = photo.kind === 'video';
  useEffect(() => {
    // Videos are fetched only when opened, never just because a grid cell is visible.
    if (video) return;
    let cancelled = false;
    const repair = attempt > lastAttempt.current;
    lastAttempt.current = attempt;
    void photoUri(owner, photo.id, repair)
      .then((value) => {
        if (!cancelled) {
          setUri(value);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUri(undefined);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [owner, photo.id, photo.localPath, photo.sha256, photo.s3Key, attempt, video]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${photo.hidden ? 'Hidden ' : ''}${video ? 'video' : 'photo'}${selected ? ', selected' : ''}${failed ? ', tap to retry' : ''}${photo.status === 'rejected' ? ', backup unavailable' : ''}`}
      accessibilityState={{ selected, busy: !video && !uri && !failed }}
      onLongPress={onLongPress}
      onPress={() => {
        if (failed && !selecting) {
          setFailed(false);
          setAttempt((value) => value + 1);
        } else onPress();
      }}
      style={styles.cell}
    >
      <View
        style={[
          styles.photo,
          {
            aspectRatio: !video && uri ? undefined : 0.85,
            borderWidth: selected ? 2 : 0,
            backgroundColor: colors.surfaceMuted,
            borderColor: selected ? colors.primary : colors.surfaceMuted,
          },
        ]}
      >
        {video ? (
          <View style={styles.placeholder}>
            <Ionicons name="play-circle-outline" size={34} color={colors.textMuted} />
            <Text variant="caption" color="muted" center>
              {photo.localPath ? 'Video' : 'Video · tap to load'}
            </Text>
          </View>
        ) : uri ? (
          <FitImage
            key={photo.sha256}
            uri={uri}
            accessibilityLabel="Private photo"
            cachePolicy="none"
            recyclingKey={`${photo.id}:${photo.sha256}`}
            onError={() => {
              setUri(undefined);
              setFailed(true);
            }}
          />
        ) : failed ? (
          <View style={styles.placeholder}>
            <Ionicons name="cloud-download-outline" size={24} color={colors.textMuted} />
            <Text variant="caption" color="muted" center>
              Tap to load
            </Text>
          </View>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
        {Boolean(photo.hidden) && (
          <View style={[styles.hidden, { backgroundColor: colors.overlay }]}>
            <Ionicons name="eye-off-outline" size={15} color={colors.onImage} />
          </View>
        )}
        {selected && (
          <View style={[styles.selected, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
          </View>
        )}
        {photo.status === 'rejected' && (
          <View style={[styles.rejected, { backgroundColor: colors.overlay }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.onImage} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  cell: { width: '33.3333%', padding: spacing.xs },
  photo: {
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { alignItems: 'center', gap: spacing.xs, padding: spacing.xs },
  hidden: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  selected: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  rejected: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
});
