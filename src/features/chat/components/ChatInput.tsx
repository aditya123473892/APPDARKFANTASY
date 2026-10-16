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
  onChangeText,
  onAttach,
  bottomInset,
  disabled = false,
  canSendMessages = false,
  canShareMedia = false,
  placeholder = 'Write a message…',
  draftValue,
  onDraftChange,
  timerLabel,
  onTimerPress,
}: {
  onSend: (value: string) => void;
  /** Called with the draft as it changes (e.g. for typing indicators). */
  onChangeText?: (value: string) => void;
  onAttach?: () => void;
  /** Gesture/navigation bar height. Pass 0 while the keyboard is open. */
  bottomInset: number;
  disabled?: boolean;
  canSendMessages?: boolean;
  canShareMedia?: boolean;
  placeholder?: string;
  draftValue?: string;
  onDraftChange?: (text: string) => void;
  timerLabel?: string | null;
  onTimerPress?: () => void;
}): React.JSX.Element {
  const [localValue, setLocalValue] = useState('');
  const value = draftValue ?? localValue;
  const setValue = (text: string) => {
    if (draftValue === undefined) setLocalValue(text);
    onDraftChange?.(text);
  };
  const lastSend = useRef(0);
  const { theme } = useTheme();
  const canSend = !disabled && canSendMessages && value.trim().length > 0;

  const send = (): void => {
    const text = value.trim();
    // Ignore a second tap that lands before the input has cleared (prevents accidental double sends).
    const now = Date.now();
    if (!text || disabled || !canSendMessages || now - lastSend.current < 400) return;
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
      {onAttach && canShareMedia ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach photos or videos"
          disabled={disabled}
          onPress={onAttach}
          style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons
            name="attach-outline"
            size={24}
            color={disabled ? theme.colors.textMuted : theme.colors.primary}
          />
        </Pressable>
      ) : null}
      {onTimerPress && canSendMessages ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            timerLabel ? `Disappearing messages: ${timerLabel}` : 'Disappearing messages: off'
          }
          disabled={disabled}
          onPress={onTimerPress}
          style={styles.timer}
        >
          <Ionicons
            name={timerLabel ? 'timer' : 'timer-outline'}
            size={22}
            color={
              disabled
                ? theme.colors.textMuted
                : timerLabel
                  ? theme.colors.primary
                  : theme.colors.textMuted
            }
          />
          {timerLabel ? (
            <Text variant="caption" color="primary" style={styles.timerLabel}>
              {timerLabel}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
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
          editable={!disabled && canSendMessages}
          maxLength={MAX_LENGTH}
          maxFontSizeMultiplier={typography.maxFontScale}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            onChangeText?.(text);
          }}
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
  timer: { width: 36, height: 44, justifyContent: 'center', alignItems: 'center' },
  timerLabel: { fontSize: 10, lineHeight: 12, marginTop: -2 },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
