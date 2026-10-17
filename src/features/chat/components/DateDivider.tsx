import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
export function DateDivider({ label }: { label: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.pill, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Text variant="caption" weight="semibold" color="secondary">
          {label}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
