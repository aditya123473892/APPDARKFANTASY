import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
export function DateDivider({ label }: { label: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text variant="caption" color="secondary">
          {label}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { alignItems: 'center', marginVertical: spacing.md },
  pill: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
