import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { useServerWake } from '@/services/api/serverWake';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** Explains the delay while the sleeping backend starts up. Mounted once at the root. */
export function ServerWakeBanner(): React.JSX.Element | null {
  const waking = useServerWake((state) => state.waking);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!waking) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Animated.View
        entering={FadeInUp.duration(200)}
        exiting={FadeOutUp.duration(150)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
        ]}
      >
        <Ionicons name="cloud-outline" size={16} color={theme.colors.primaryText} />
        <Text variant="caption" weight="semibold" style={styles.text}>
          Waking up the server… this can take up to a minute.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 520,
  },
  text: { flexShrink: 1 },
});
