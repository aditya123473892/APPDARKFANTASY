import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Chip, Text } from '@/components/ui';
export function FilterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">Discovery preferences</Text>
      <Text color="muted">Show me</Text>
      <View style={styles.row}>
        <Chip label="Everyone" selected />
        <Chip label="Women" />
        <Chip label="Men" />
      </View>
      <Text color="muted">Interests</Text>
      <View style={styles.row}>
        <Chip label="Travel" selected />
        <Chip label="Music" />
        <Chip label="Art" selected />
        <Chip label="Food" />
      </View>
      <Button label="Apply filters" onPress={onClose} />
    </BottomSheet>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
