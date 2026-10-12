import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
export function OfflineBanner(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, { backgroundColor: theme.palette.amber400 }]}
    >
      <Text variant="caption" weight="bold" style={{ color: theme.palette.ink950 }}>
        You're offline. Showing saved content.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({ base: { padding: 8, alignItems: 'center' } });
