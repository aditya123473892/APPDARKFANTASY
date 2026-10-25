import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export function SocialSheet({
  visible,
  onClose,
  title,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void; title: string }>) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dx) < 30,
        onPanResponderRelease: (_, g) => {
          if (g.dy > 50 || g.vy > 0.6) onClose();
        },
      }),
    [onClose],
  );
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            height: '75%',
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            overflow: 'hidden',
          }}
        >
          <View
            {...pan.panHandlers}
            style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.sm }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: theme.colors.border,
              }}
            />
            <Text weight="semibold" accessibilityRole="header" style={{ paddingTop: spacing.md }}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={{
                position: 'absolute',
                right: spacing.sm,
                top: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text color="muted">×</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
