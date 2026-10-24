import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { typography, radius } from '@/theme';

/**
 * One real input drawn as digit cells, so the OS can fill the whole code from the
 * SMS: iOS suggests it above the keyboard (oneTimeCode), Android through autofill
 * (sms-otp). Screen readers see a single "Verification code" field.
 */
export const OTPInput = forwardRef<
  TextInputInstance,
  {
    value: string;
    onChangeText: (value: string) => void;
    length?: number;
    error?: boolean;
    editable?: boolean;
    autoFocus?: boolean;
    onComplete?: (code: string) => void;
  }
>(function OTPInput(
  { value, onChangeText, length = 6, error = false, editable = true, autoFocus, onComplete },
  ref,
) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) => (
        <View
          key={index}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.cell,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: error
                ? theme.colors.danger
                : index === Math.min(value.length, length - 1)
                  ? theme.colors.primary
                  : theme.colors.border,
            },
          ]}
        >
          <Text style={styles.digit}>{value[index] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, length);
          onChangeText(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        editable={editable}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        caretHidden
        contextMenuHidden={false}
        selectionColor="transparent"
        accessibilityLabel="Verification code"
        accessibilityHint={`Enter the ${length}-digit code from the SMS`}
        style={styles.input}
      />
    </View>
  );
});
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  cell: {
    flex: 1,
    minWidth: 44,
    height: 54,
    borderWidth: 1,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 20, fontFamily: typography.family.bold },
  // Invisible but laid over the cells, so taps, long-press paste and autofill reach it.
  input: { ...StyleSheet.absoluteFill, opacity: 0.011, color: 'transparent' },
});
