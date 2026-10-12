import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
export function BottomSheet({
  visible,
  onClose,
  children,
}: React.PropsWithChildren<{ visible: boolean; onClose: () => void }>): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
      >
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999 },
});
