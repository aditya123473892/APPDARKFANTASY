import { StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function Chip({
  label,
  selected = false,
  onPress,
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityState={onPress ? { checked: selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        onPress && { minHeight: spacing.touch },
        {
          backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surfaceElevated,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        variant={size === 'sm' ? 'caption' : 'label'}
        weight="medium"
        style={{ color: selected ? theme.colors.primaryText : theme.colors.textSecondary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 26, paddingHorizontal: spacing.sm },
});
