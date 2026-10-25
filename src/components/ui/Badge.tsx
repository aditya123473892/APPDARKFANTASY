import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';

export function Badge({
  value,
  variant = 'unread',
}: {
  value?: number | string;
  variant?: 'unread' | 'verified' | 'premium';
}): React.JSX.Element {
  const { theme } = useTheme();
  if (variant !== 'unread')
    return (
      <Ionicons
        accessibilityLabel={variant === 'verified' ? 'Verified' : 'Premium'}
        name={variant === 'verified' ? 'checkmark-circle' : 'sparkles-outline'}
        size={18}
        color={theme.colors.gold}
      />
    );
  const display = typeof value === 'number' && value > 99 ? '99+' : value;
  return (
    <View
      accessibilityLabel={`${display} unread`}
      style={[styles.base, { backgroundColor: theme.colors.primary }]}
    >
      <Text variant="caption" weight="bold" color="inverse" maxFontSizeMultiplier={1.2}>
        {display}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
