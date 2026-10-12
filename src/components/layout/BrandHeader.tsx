import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function BrandHeader({ inbox = true }: { inbox?: boolean }): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  return <View style={[styles.root, { borderBottomColor: theme.colors.divider, backgroundColor: theme.colors.background }]}>
    <View style={styles.side} />
    <View style={styles.brand}><Text variant="heading" weight="bold">DARKFANTASY</Text><View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /></View>
    <View style={styles.side}>{inbox ? <IconButton icon="chatbubble-outline" label="Open messages" onPress={() => router.push('/chats')} /> : null}</View>
  </View>;
}
const styles = StyleSheet.create({
  root: { height: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: spacing.sm },
  side: { width: spacing.touch, alignItems: 'center' }, brand: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 999, marginLeft: 2, marginTop: -12 },
});
