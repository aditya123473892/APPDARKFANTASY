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
          borderTopColor: theme.colors.divider,
          backgroundColor: theme.colors.tabBar,
          paddingBottom: spacing.sm + bottomInset,
        },
      ]}
    >
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
      <View style={[styles.field, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Insert smile emoji"
          disabled={disabled || !canSendMessages}
          hitSlop={4}
          onPress={() => {
            const next = `${value}😊`.slice(0, MAX_LENGTH);
            setValue(next);
            onChangeText?.(next);
          }}
          style={styles.fieldIcon}
        >
          <Ionicons name="happy-outline" size={23} color={theme.colors.textMuted} />
        </Pressable>
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
        {onAttach && canShareMedia ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach photos or videos"
            disabled={disabled}
            hitSlop={4}
            onPress={onAttach}
            style={styles.fieldIcon}
          >
            <Ionicons
              name="attach"
              size={24}
              color={disabled ? theme.colors.textMuted : theme.colors.textSecondary}
              style={styles.attachIcon}
            />
          </Pressable>
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
              : theme.colors.surfaceMuted,
          },
        ]}
      >
        <Ionicons
          name="send"
          size={19}
          color={canSend ? theme.colors.onPrimary : theme.colors.textMuted}
          style={styles.sendIcon}
        />
      </Pressable>
    </View>
  );
}

const FIELD = 44;
const styles = StyleSheet.create({
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm - 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm - 2,
  },
  field: {
    flex: 1,
    minHeight: FIELD,
    borderRadius: FIELD / 2,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily,
    maxHeight: 140,
    minHeight: FIELD,
    paddingHorizontal: spacing.xs,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md - 2,
  },
  counter: { position: 'absolute', right: spacing.md, top: 2 },
  fieldIcon: { width: 38, height: FIELD, alignItems: 'center', justifyContent: 'center' },
  attachIcon: { transform: [{ rotate: '45deg' }] },
  timer: { width: 36, height: FIELD, justifyContent: 'center', alignItems: 'center' },
  timerLabel: { fontSize: 10, lineHeight: 12, marginTop: -2 },
  send: {
    width: FIELD,
    height: FIELD,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { marginLeft: 2 },
});
