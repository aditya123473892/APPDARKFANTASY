import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { discardPost, retryPost, usePostQueue } from './postQueue';

/** Posts still publishing after their composer closed, shown above the feed. */
export function PendingPosts(): React.JSX.Element | null {
  const items = usePostQueue((state) => state.items);
  const { theme } = useTheme();
  if (!items.length) return null;
  return (
    <View style={styles.list}>
      {items.map((item) => {
        const failed = item.state === 'failed';
        return (
          <View
            key={item.id}
            style={[
              styles.row,
              { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
            ]}
          >
            {item.cover ? (
              <Image source={{ uri: item.cover }} contentFit="cover" style={styles.cover} />
            ) : (
              <View style={[styles.cover, { backgroundColor: theme.colors.surfaceMuted }]} />
            )}
            <View style={styles.body}>
              <Text weight="semibold" accessibilityLiveRegion="polite">
                {failed
                  ? "Couldn't post"
                  : item.state === 'finishing'
                    ? 'Processing…'
                    : `Posting… ${Math.round(item.progress)}%`}
              </Text>
              {failed ? (
                <Text variant="caption" color="muted" numberOfLines={2}>
                  {item.error}
                </Text>
              ) : (
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(item.progress) }}
                  style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}
                >
                  <View
                    style={[
                      styles.track,
                      { width: `${Math.max(4, item.progress)}%`, backgroundColor: theme.colors.primary },
                    ]}
                  />
                </View>
              )}
            </View>
            {failed ? (
              <View style={styles.actions}>
                <Button label="Retry" size="sm" fullWidth={false} onPress={() => retryPost(item.id)} />
                <Button
                  label="Discard"
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => discardPost(item.id)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: 44, height: 44, borderRadius: radius.sm },
  body: { flex: 1, gap: spacing.xs },
  track: { height: 3, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
