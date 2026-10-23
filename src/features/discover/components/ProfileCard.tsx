import { Ionicons } from '@expo/vector-icons';
import { Can } from '@/features/auth/components/Access';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FitImage, Text } from '@/components/ui';
import type { ProfileView } from '@/features/profile/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance } from '@/utils/formatters';

type ActionMeta = { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean };

export function relationshipAction(profile: ProfileView): ActionMeta {
  switch (profile.relationship.status) {
    case 'incoming':
      return { label: 'Accept', icon: 'heart', active: true };
    case 'outgoing':
      return { label: 'Requested', icon: 'time-outline', active: false };
    case 'connected':
      return { label: 'Message', icon: 'chatbubble', active: true };
    default:
      return { label: 'Connect', icon: 'heart-outline', active: true };
  }
}

export const ProfileCard = memo(function ProfileCard({
  profile,
  width,
  showDistance,
  pending,
  onOpen,
  onAction,
}: {
  profile: ProfileView;
  width: number;
  showDistance: boolean;
  pending: boolean;
  onOpen: (profile: ProfileView) => void;
  onAction: (profile: ProfileView) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const action = relationshipAction(profile);
  const subtitle = (showDistance ? formatDistance(profile.distanceKm) : null) ?? profile.location;
  const disabled = pending || profile.relationship.status === 'outgoing';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}, ${profile.age}. ${subtitle ?? ''}. Open profile`}
      onPress={() => onOpen(profile)}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
        pressed && styles.pressed,
      ]}
    >
      <FitImage uri={profile.avatarUri} recyclingKey={profile.id} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[theme.colors.overlayTransparent, theme.colors.overlayStrong]}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {profile.relationship.status === 'incoming' ? (
        <View style={[styles.tag, { backgroundColor: theme.colors.primary }]}>
          <Text variant="caption" weight="bold" color="inverse">
            Likes you
          </Text>
        </View>
      ) : null}
      <View style={styles.info}>
        <Text
          variant="subheading"
          serif
          weight="bold"
          numberOfLines={1}
          style={{ color: theme.colors.onImage }}
        >
          {profile.name}, {profile.age}
        </Text>
        {subtitle ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={theme.colors.imageGold} />
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.flex, { color: theme.colors.imageGold }]}
            >
              {subtitle}
            </Text>
          </View>
        ) : null}
        {profile.interests[0] ? (
          <Text variant="caption" numberOfLines={1} style={{ color: theme.colors.imageMuted }}>
            {profile.interests.slice(0, 2).join(' · ')}
          </Text>
        ) : null}
        <Can capability="canRequestConnection">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action.label} ${profile.name}`}
            accessibilityState={{ disabled, busy: pending }}
            disabled={disabled}
            hitSlop={4}
            onPress={() => onAction(profile)}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: action.active ? theme.colors.primary : theme.colors.overlay,
                borderColor: action.active ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {pending ? (
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
            ) : (
              <>
                <Ionicons
                  name={action.icon}
                  size={15}
                  color={action.active ? theme.colors.onPrimary : theme.colors.textSecondary}
                />
                <Text
                  variant="caption"
                  weight="bold"
                  style={{
                    color: action.active ? theme.colors.onPrimary : theme.colors.textSecondary,
                  }}
                >
                  {action.label}
                </Text>
              </>
            )}
          </Pressable>
        </Can>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    aspectRatio: 0.68,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  tag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  info: { padding: spacing.md, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flex: { flex: 1 },
  action: {
    marginTop: spacing.sm,
    minHeight: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
