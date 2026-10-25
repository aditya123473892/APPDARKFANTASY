import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Text } from './Text';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
};
export function ListRow({
  title,
  subtitle,
  leading,
  icon,
  trailing,
  onPress,
  divider = true,
}: ListRowProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <AnimatedPressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      {leading ??
        (icon ? <Ionicons name={icon} size={24} color={theme.colors.textSecondary} /> : null)}
      <View style={styles.copy}>
        <Text numberOfLines={2}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        ) : null)}
    </AnimatedPressable>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
});
