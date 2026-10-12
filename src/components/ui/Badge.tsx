import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export function Badge({ value }: { value: number | string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: theme.colors.primary }]}>
      <Text variant="caption" weight="bold" style={{ color: theme.palette.white }}>
        {value}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
