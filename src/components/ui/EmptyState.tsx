import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function EmptyState({ icon = 'sparkles-outline', title, message }: { icon?: keyof typeof Ionicons.glyphMap; title: string; message: string }): React.JSX.Element {
  const { theme } = useTheme();
  return <View style={styles.root}><Ionicons name={icon} size={28} color={theme.colors.textMuted} /><Text variant="heading">{title}</Text><Text color="muted" center>{message}</Text></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, minHeight: 240, padding: spacing.xxl, gap: spacing.sm, alignItems: 'center', justifyContent: 'center' } });
