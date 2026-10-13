import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** Name, age, presence and the work/location line. Shared by "my profile" and other people's profiles. */
export function ProfileHeader({
  user,
  presence,
  distance,
}: {
  user: User;
  presence?: string | null;
  distance?: string | null;
}): React.JSX.Element {
  const { theme } = useTheme();
  const meta: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (user.occupation) meta.push({ icon: 'briefcase-outline', text: user.occupation });
  if (distance ?? user.location)
    meta.push({ icon: 'location-outline', text: (distance ?? user.location)! });
  return (
    <View style={styles.root}>
      <Text variant="title" accessibilityRole="header">
        {user.name}, {user.age}
      </Text>
      {presence ? (
        <View style={styles.row}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  presence === 'Online now' ? theme.colors.success : theme.colors.textMuted,
              },
            ]}
          />
          <Text variant="caption" color={presence === 'Online now' ? 'success' : 'secondary'}>
            {presence}
          </Text>
        </View>
      ) : null}
      {meta.length ? (
        <View style={styles.meta}>
          {meta.map((item) => (
            <View key={item.icon} style={styles.row}>
              <Ionicons name={item.icon} size={15} color={theme.colors.textSecondary} />
              <Text variant="label" weight="regular" color="secondary">
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: spacing.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 999 },
});
