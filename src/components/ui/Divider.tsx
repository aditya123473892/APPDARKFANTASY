import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
export function Divider(): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={[styles.base, { backgroundColor: theme.colors.border }]} />;
}
const styles = StyleSheet.create({ base: { height: StyleSheet.hairlineWidth, width: '100%' } });
