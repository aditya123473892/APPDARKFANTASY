import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/ui';
import { spacing } from '@/theme';
export function InterestChips({
  interests,
  highlight = [],
}: {
  interests: string[];
  /** Interests shared with the viewer are highlighted. */
  highlight?: string[];
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      {interests.map((interest) => (
        <Chip key={interest} label={interest} selected={highlight.includes(interest)} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
