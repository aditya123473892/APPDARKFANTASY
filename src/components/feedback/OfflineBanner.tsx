import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
export function OfflineBanner({
  message = "You're offline. Showing saved content.",
}: {
  message?: string;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { backgroundColor: theme.colors.dangerSoft }]}
    >
      <Ionicons name="cloud-offline-outline" size={15} color={theme.colors.danger} />
      <Text variant="caption" weight="semibold" color="danger">
        {message}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
