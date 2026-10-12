import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
export function Wordmark({ large = false }: { large?: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={styles.row}><Text variant={large ? 'display' : 'heading'} weight="bold">DARKFANTASY</Text><View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /></View>;
}
const styles = StyleSheet.create({ row: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 999, marginLeft: 3, marginTop: -16 } });
