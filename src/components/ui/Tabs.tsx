import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type TabsProps<T extends string> = { items: readonly T[]; value: T; onChange: (value: T) => void };
export function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={[styles.row, { borderBottomColor: theme.colors.divider }]}>{items.map((item) => {
    const active = item === value;
    return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(item)} style={styles.tab}>
      <Text variant="label" color={active ? 'default' : 'muted'}>{item}</Text>
      <View style={[styles.indicator, { backgroundColor: active ? theme.colors.primary : 'transparent' }]} />
    </Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1 }, tab: { flex: 1, minHeight: spacing.touch, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  indicator: { height: 2, width: 28 },
});
