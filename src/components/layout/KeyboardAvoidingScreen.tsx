import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
export function KeyboardAvoidingScreen({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.base}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ base: { flex: 1 } });
