import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
export function TypingIndicator({ name }: { name: string }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Text color="muted">•••</Text>
      </View>
      <Text variant="caption" color="muted">
        {name} is typing
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
});
