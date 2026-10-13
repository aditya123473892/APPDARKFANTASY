import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import type { ProfileView } from '@/features/profile/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance } from '@/utils/formatters';

export function SwipeCard({
  profile,
  showDistance,
  showPresence,
}: {
  profile: ProfileView;
  showDistance: boolean;
  showPresence: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const distance = showDistance ? formatDistance(profile.distanceKm) : null;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
      ]}
    >
      <Image
        source={{ uri: profile.avatarUri }}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={profile.id}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`${profile.name}'s profile photo`}
      />
      <LinearGradient
        colors={[theme.colors.overlayTransparent, theme.colors.overlayStrong]}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {profile.relationship.status === 'incoming' ? (
          <View style={[styles.tag, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="heart" size={12} color={theme.colors.onPrimary} />
            <Text variant="caption" weight="bold" color="inverse">
              Wants to connect with you
            </Text>
          </View>
        ) : null}
        <View style={styles.nameRow}>
          <Text variant="title" numberOfLines={1} style={styles.name}>
            {profile.name}, {profile.age}
          </Text>
          {showPresence && profile.presence?.online ? (
            <View
              accessibilityLabel="Online now"
              style={[styles.online, { backgroundColor: theme.colors.success }]}
            />
          ) : null}
        </View>
        <Text variant="label" color="secondary" numberOfLines={1}>
          {[profile.occupation, distance ?? profile.location].filter(Boolean).join(' · ')}
        </Text>
        <Text numberOfLines={3}>{profile.bio}</Text>
        <View style={styles.chips}>
          {profile.interests.slice(0, 3).map((interest) => (
            <Chip key={interest} label={interest} size="sm" />
          ))}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  content: { padding: spacing.xl, gap: spacing.sm },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  online: { width: 10, height: 10, borderRadius: 999 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
});
