import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Chip, Text } from '@/components/ui';
import { spacing } from '@/theme';

type FilterProps = {
  interests: string[];
  selected: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
};

/** Mounted only while the sheet is open, so the draft always starts from the applied filters. */
function FilterBody({ interests, selected, onApply, onClose }: FilterProps): React.JSX.Element {
  const [draft, setDraft] = useState<string[]>(selected);
  const toggle = (interest: string) =>
    setDraft((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  return (
    <>
      <View style={styles.header}>
        <Text variant="heading">Filter by interests</Text>
        <Text color="secondary">Show people who share at least one of these.</Text>
      </View>
      <View style={styles.row}>
        {interests.map((interest) => (
          <Chip
            key={interest}
            label={interest}
            selected={draft.includes(interest)}
            onPress={() => toggle(interest)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label="Clear"
          variant="secondary"
          disabled={!draft.length}
          onPress={() => setDraft([])}
          style={styles.action}
        />
        <Button
          label={draft.length ? `Apply (${draft.length})` : 'Show everyone'}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          style={styles.action}
        />
      </View>
    </>
  );
}

/** Interest filter. Applied client-side to the profiles already loaded. */
export function FilterSheet({
  visible,
  ...props
}: FilterProps & { visible: boolean }): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onClose={props.onClose}>
      {visible ? <FilterBody {...props} /> : null}
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
