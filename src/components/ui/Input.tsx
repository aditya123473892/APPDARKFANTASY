import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing, typography } from '@/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showCount?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    icon,
    showCount,
    style,
    onFocus,
    onBlur,
    multiline,
    editable = true,
    ...props
  },
  ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const length = typeof props.value === 'string' ? props.value.length : 0;
  return (
    <View style={styles.group}>
      {label ? (
        <Text variant="label" color="secondary">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.wrapper,
          multiline && styles.multilineWrapper,
          {
            backgroundColor: editable ? theme.colors.surfaceElevated : theme.colors.surface,
            borderColor: error
              ? theme.colors.danger
              : focused
                ? theme.colors.primary
                : theme.colors.border,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={19} color={theme.colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          maxFontSizeMultiplier={typography.maxFontScale}
          editable={editable}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: editable ? theme.colors.text : theme.colors.textSecondary },
            style,
          ]}
          autoCapitalize="none"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </View>
      {error || hint || (showCount && props.maxLength) ? (
        <View style={styles.meta}>
          <Text variant="caption" color={error ? 'danger' : 'muted'} style={styles.metaText}>
            {error ?? hint ?? ''}
          </Text>
          {showCount && props.maxLength ? (
            <Text variant="caption" color={length >= props.maxLength ? 'danger' : 'muted'}>
              {length}/{props.maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  wrapper: {
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md + 2,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  multilineWrapper: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: {
    flex: 1,
    minHeight: spacing.touch - 4,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily,
  },
  multiline: { minHeight: 96, maxHeight: 180, paddingTop: spacing.sm },
  meta: { flexDirection: 'row', gap: spacing.sm },
  metaText: { flex: 1 },
});
