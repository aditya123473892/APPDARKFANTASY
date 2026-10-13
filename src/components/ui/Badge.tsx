import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function Badge({ value }: { value: number | string }): React.JSX.Element {
  const { theme } = useTheme();
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
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
