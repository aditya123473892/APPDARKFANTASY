import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FitImage, Text } from '@/components/ui';
import { media, radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function EventCover({
  uri,
  hasCover,
  label,
  onRetry,
}: {
  uri: string;
  hasCover: boolean;
  label: string;
  onRetry: () => Promise<unknown>;
}) {
  const { theme } = useTheme();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  const [retrying, setRetrying] = useState(false);
  const key = `${uri}:${attempt}`;
  const unavailable = !uri || failed === key;
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      // Refetch first: private cover URLs expire and must be authorized again.
      await onRetry();
      setAttempt((value) => value + 1);
    } catch {
      // Keep the unavailable state visible so another attempt remains possible.
    } finally {
      setRetrying(false);
    }
  };

  if (unavailable) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Ionicons name="image-outline" size={32} color={theme.colors.textMuted} />
        <Text color="muted">{hasCover ? 'Cover photo unavailable' : 'No cover photo'}</Text>
        {hasCover && (
          <Button
            label="Retry photo"
            variant="ghost"
            loading={retrying}
            onPress={() => void retry()}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <FitImage
        key={key}
        uri={uri}
        recyclingKey={key}
        accessibilityLabel={label}
        onLoad={() => setLoaded(key)}
        onError={() => setFailed(key)}
      />
      {loaded !== key && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator
            color={theme.colors.primary}
            accessibilityLabel="Loading event cover"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  placeholder: {
    width: '100%',
    aspectRatio: media.eventRatio,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
