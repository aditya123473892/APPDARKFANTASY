import { Modal as RNModal, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';

export function Modal({
  visible,
  title,
  children,
  onClose,
}: React.PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
      >
        <Pressable style={[styles.content, { backgroundColor: theme.colors.surface }]}>
          <Text variant="heading">{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  content: { borderRadius: 20, padding: 20, gap: 16 },
});
