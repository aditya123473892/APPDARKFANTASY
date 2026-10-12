import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceMuted,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text variant="label" style={{ color: selected ? theme.palette.white : theme.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
