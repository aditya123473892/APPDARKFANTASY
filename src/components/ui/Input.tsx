import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing, typography } from '@/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, icon, style, onFocus, onBlur, ...props },
  ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
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
        {icon ? <Ionicons name={icon} size={19} color={theme.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          style={[styles.input, { color: theme.colors.text }, style]}
          autoCapitalize="none"
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...props}
        />
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
