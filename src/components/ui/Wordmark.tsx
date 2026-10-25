import { radius, spacing } from '@/theme';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
import { Ionicons } from '@expo/vector-icons';
export function Wordmark({ large = false }: { large?: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, large && styles.large]}>
      {large ? (
        <View
          style={[
            styles.mark,
            { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border },
          ]}
        >
          <Ionicons name="moon-outline" size={32} color={theme.colors.primaryText} />
        </View>
      ) : null}
      <Text variant={large ? 'title' : 'heading'} weight="bold">
        Darkfantasy
      </Text>
      {!large ? <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center' },
  large: { flexDirection: 'column', gap: spacing.lg, marginTop: spacing.xl },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginLeft: spacing.xs,
    marginTop: -spacing.lg,
  },
});
