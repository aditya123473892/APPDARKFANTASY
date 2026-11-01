import { useMemo } from 'react';
import { Modal, PanResponder, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Pressable } from '@/components/ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
export function BottomSheet({
  visible,
  onClose,
  children,
}: React.PropsWithChildren<{ visible: boolean; onClose: () => void }>): React.JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dx) < 30,
    onPanResponderRelease: (_, g) => { if (g.dy > 50 || g.vy > 0.6) onClose(); },
  }), [onClose]);
  return (
    <Modal
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.flex}>
        <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
        />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                paddingBottom: spacing.xxl + insets.bottom,
              },
            ]}
          >
            <View {...pan.panHandlers} style={{ paddingVertical: spacing.sm }}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full },
});
