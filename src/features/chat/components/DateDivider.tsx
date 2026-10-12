import { StyleSheet, View } from 'react-native';
import { Divider, Text } from '@/components/ui';
export function DateDivider({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Divider />
      </View>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      <View style={styles.line}>
        <Divider />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  line: { flex: 1 },
});
