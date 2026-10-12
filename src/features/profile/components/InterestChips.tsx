import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/ui';
export function InterestChips({ interests }: { interests: string[] }): React.JSX.Element {
  return (
    <View style={styles.row}>
      {interests.map((interest) => (
        <Chip key={interest} label={interest} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
