import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
export function Loader({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View accessibilityRole="progressbar" style={styles.base}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text color="muted">{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
