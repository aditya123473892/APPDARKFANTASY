import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

/**
 * Keeps inputs above the on-screen keyboard. Android runs edge-to-edge (SDK 57),
 * so the window no longer resizes for the keyboard and padding is needed on both platforms.
 */
export function KeyboardAvoidingScreen({
  children,
  offset = 0,
}: PropsWithChildren<{ offset?: number }>): React.JSX.Element {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={styles.base}>
      {children}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ base: { flex: 1 } });
