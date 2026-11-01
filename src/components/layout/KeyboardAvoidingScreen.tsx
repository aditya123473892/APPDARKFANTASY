import { type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * Follows native keyboard insets, including Android edge-to-edge windows.
 * automaticOffset uses native coordinates rather than RN's affected measurements.
 * Wrap the whole Screen (including its safe area and header) in chat layouts so
 * a failed mount-time native measurement cannot lose the header's screen offset.
 */
export function KeyboardAvoidingScreen({
  children,
  offset = 0,
}: PropsWithChildren<{ offset?: number }>): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      automaticOffset
      keyboardVerticalOffset={offset}
      style={styles.base}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ base: { flex: 1, minHeight: 0 } });
