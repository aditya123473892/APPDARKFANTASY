import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function BrandHeader({ onCompose }: { onCompose?: () => void }): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <View style={[styles.root, { borderBottomColor: theme.colors.divider }]}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="DARKFANTASY">
        <Text variant="heading" weight="bold" style={styles.wordmark}>
          DARKFANTASY
        </Text>
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={styles.actions}>
        <IconButton
          icon="create-outline"
          label="Create a post"
          onPress={onCompose ?? (() => router.push('/create'))}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.screen,
    paddingRight: spacing.sm,
  },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  wordmark: { letterSpacing: 1.5 },
  dot: { width: 6, height: 6, borderRadius: 999, marginLeft: 3, marginTop: -12 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
