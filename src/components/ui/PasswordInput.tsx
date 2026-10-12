import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing, typography } from '@/theme';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label?: string;
  error?: string;
};

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(
  { label, error, style, onFocus, onBlur, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  return (
    <View style={styles.group}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View
        style={[
          styles.wrapper,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={19} color={theme.colors.textMuted} />
        <TextInput
          ref={ref}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="oneTimeCode"
          autoComplete="off"
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          style={[styles.input, { color: theme.colors.text }, style]}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...props}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={12}
          onPress={() => setVisible((value) => !value)}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={21}
            color={theme.colors.textMuted}
          />
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  wrapper: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: { flex: 1, minHeight: spacing.touch, fontSize: typography.size.md },
});
