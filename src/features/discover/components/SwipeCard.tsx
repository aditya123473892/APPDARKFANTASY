import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
import { useTheme } from '@/theme/useTheme';

export function SwipeCard({ user }: { user: User }): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, theme.shadows.lg, { backgroundColor: theme.colors.surface }]}>
      <Image
        source={{ uri: user.avatarUri }}
        contentFit="cover"
        transition={180}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`${user.name}'s profile photo`}
      />
      <LinearGradient colors={[theme.colors.overlayTransparent, theme.colors.overlayStrong]} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text variant="title" style={{ color: theme.palette.white }}>
              {user.name}, {user.age}
            </Text>
            <View style={[styles.online, { backgroundColor: theme.colors.success }]} />
          </View>
          <Text style={{ color: theme.palette.ink100 }}>{user.bio}</Text>
          <View style={styles.chips}>
            {user.interests.slice(0, 3).map((interest) => (
              <Chip key={interest} label={interest} />
            ))}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  gradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  content: { padding: 20, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  online: { width: 10, height: 10, borderRadius: 999 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
