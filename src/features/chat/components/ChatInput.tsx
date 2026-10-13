import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const MAX_LENGTH = 2000;

export function ChatInput({
  onSend,
  bottomInset,
  disabled = false,
  placeholder = 'Write a message…',
}: {
  onSend: (value: string) => void;
  /** Gesture/navigation bar height. Pass 0 while the keyboard is open. */
  bottomInset: number;
  disabled?: boolean;
  placeholder?: string;
}): React.JSX.Element {
  const [value, setValue] = useState('');
  const lastSend = useRef(0);
  const { theme } = useTheme();
  const canSend = !disabled && value.trim().length > 0;

  const send = (): void => {
    const text = value.trim();
    // Ignore a second tap that lands before the input has cleared (prevents accidental double sends).
    const now = Date.now();
    if (!text || disabled || now - lastSend.current < 400) return;
    lastSend.current = now;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setValue('');
    onSend(text);
  };

  return (
    <View
      style={[
        styles.root,
        {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
          paddingBottom: spacing.sm + bottomInset,
        },
      ]}
    >
      <View
        style={[
          styles.field,
          { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
        ]}
      >
        <TextInput
          accessibilityLabel="Message"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          multiline
          editable={!disabled}
          maxLength={MAX_LENGTH}
          maxFontSizeMultiplier={typography.maxFontScale}
          value={value}
          onChangeText={setValue}
          textAlignVertical="center"
          style={[styles.input, { color: theme.colors.text }]}
        />
        {value.length > MAX_LENGTH * 0.9 ? (
          <Text
            variant="caption"
            color={value.length >= MAX_LENGTH ? 'danger' : 'muted'}
            style={styles.counter}
          >
            {MAX_LENGTH - value.length}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={send}
        style={({ pressed }) => [
          styles.send,
          {
            backgroundColor: canSend
              ? pressed
                ? theme.colors.primaryPressed
                : theme.colors.primary
              : theme.colors.surfaceElevated,
          },
        ]}
      >
        <Ionicons
          name="arrow-up"
          size={22}
          color={canSend ? theme.colors.onPrimary : theme.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  input: {
    maxHeight: 132,
    minHeight: 44,
    paddingTop: spacing.md - 1,
    paddingBottom: spacing.md - 1,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md - 2,
  },
  counter: { position: 'absolute', right: spacing.md, top: spacing.xs },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
