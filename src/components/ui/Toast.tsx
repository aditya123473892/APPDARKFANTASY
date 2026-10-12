import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
export function Toast({
  message,
  tone = 'default',
}: {
  message: string;
  tone?: 'default' | 'error';
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.base,
        theme.shadows.md,
        { backgroundColor: tone === 'error' ? theme.colors.danger : theme.colors.surfaceElevated },
      ]}
    >
      <Text style={{ color: tone === 'error' ? theme.palette.white : theme.colors.text }}>
        {message}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
});
