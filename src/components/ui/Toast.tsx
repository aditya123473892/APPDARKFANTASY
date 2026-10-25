import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type ToastTone = 'default' | 'success' | 'error';
type ToastAction = { label: string; onPress: () => void };
type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastAction };

type ToastState = {
  current: ToastItem | null;
  show: (message: string, options?: { tone?: ToastTone; action?: ToastAction }) => void;
  hide: () => void;
};

let nextId = 1;
export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (message, options) =>
    set({
      current: { id: nextId++, message, tone: options?.tone ?? 'default', action: options?.action },
    }),
  hide: () => set({ current: null }),
}));

/** Imperative helper so hooks and services can surface feedback without prop drilling. */
export const toast = {
  show: (message: string, action?: ToastAction) =>
    useToastStore.getState().show(message, { action }),
  success: (message: string, action?: ToastAction) =>
    useToastStore.getState().show(message, { tone: 'success', action }),
  error: (message: string, action?: ToastAction) =>
    useToastStore.getState().show(message, { tone: 'error', action }),
};

export function Toast({
  message,
  tone = 'default',
  action,
  onDismiss,
}: {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  onDismiss?: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const icon =
    tone === 'success'
      ? 'checkmark-circle'
      : tone === 'error'
        ? 'alert-circle'
        : 'information-circle';
  const iconColor =
    tone === 'success'
      ? theme.colors.success
      : tone === 'error'
        ? theme.colors.danger
        : theme.colors.secondary;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.base,
        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
      ]}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Pressable accessibilityHint="Dismiss" onPress={onDismiss} style={styles.message}>
        <Text variant="label" weight="medium">
          {message}
        </Text>
      </Pressable>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          onPress={() => {
            onDismiss?.();
            action.onPress();
          }}
          style={styles.action}
        >
          <Text variant="label" color="primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Renders the active toast above the bottom safe area. Mounted once at the root. */
export function ToastHost({
  bottomOffset = 0,
}: {
  bottomOffset?: number;
}): React.JSX.Element | null {
  const current = useToastStore((state) => state.current);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(hide, current.action ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [current, hide]);
  if (!current) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + bottomOffset + spacing.lg }]}
    >
      <Animated.View
        key={current.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
      >
        <Toast
          message={current.message}
          tone={current.tone}
          action={current.action}
          onDismiss={hide}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  message: { flex: 1 },
  action: { minHeight: 32, justifyContent: 'center', paddingLeft: spacing.sm },
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignSelf: 'center',
    maxWidth: 520,
  },
});
