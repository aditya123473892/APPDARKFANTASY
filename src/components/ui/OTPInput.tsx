import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { typography, radius } from '@/theme';
export function OTPInput({
  value,
  onChangeText,
  length = 6,
}: {
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          accessibilityLabel={`Code digit ${index + 1}`}
          keyboardType="number-pad"
          maxLength={length}
          value={value[index] ?? ''}
          onChangeText={(digit) => {
            const next = value.split('');
            next[index] = digit.slice(-1);
            onChangeText(next.join(''));
          }}
          style={[
            styles.cell,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: index === value.length ? theme.colors.primary : theme.colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  cell: {
    flex: 1,
    minWidth: 44,
    height: 54,
    borderWidth: 1,
    borderRadius: radius.card,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: typography.family.bold,
  },
});
