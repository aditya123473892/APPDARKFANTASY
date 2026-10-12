import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export function ThreadLine(): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={[styles.line, { backgroundColor: theme.colors.thread }]} />;
}

const styles = StyleSheet.create({ line: { width: 1, flex: 1, minHeight: 24, marginTop: 8 } });
