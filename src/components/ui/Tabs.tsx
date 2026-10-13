import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type TabsProps<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Optional counts rendered as a small pill next to a tab label. */
  counts?: Partial<Record<T, number>>;
  variant?: 'underline' | 'segmented';
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  counts,
  variant = 'underline',
}: TabsProps<T>): React.JSX.Element {
  const { theme } = useTheme();
  const segmented = variant === 'segmented';
  return (
    <View
      accessibilityRole="tablist"
      style={
        segmented
          ? [
              styles.segmented,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]
          : [styles.row, { borderBottomColor: theme.colors.divider }]
      }
    >
      {items.map((item) => {
        const active = item === value;
        const count = counts?.[item];
        return (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={count ? `${item}, ${count} new` : item}
            onPress={() => onChange(item)}
            style={[
              segmented ? styles.segment : styles.tab,
              segmented && active && { backgroundColor: theme.colors.surfaceElevated },
            ]}
          >
            <View style={styles.labelRow}>
              <Text variant="label" color={active ? 'default' : 'muted'}>
                {item}
              </Text>
              {count ? (
                <View style={[styles.count, { backgroundColor: theme.colors.primary }]}>
                  <Text variant="caption" weight="bold" color="inverse" maxFontSizeMultiplier={1.2}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              ) : null}
            </View>
            {segmented ? null : (
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: active ? theme.colors.primary : 'transparent' },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    minHeight: spacing.touch,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm + 2,
  },
  indicator: { height: 2, width: 32, borderRadius: radius.full },
  segmented: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
