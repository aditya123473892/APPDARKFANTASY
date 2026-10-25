import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Avatar, Chip, FitImage, Text } from '@/components/ui';
import type { ProfileView } from '@/features/profile/types';
import { useFollowUser } from '@/features/requests/hooks/useRequests';
import { mediaUrl } from '@/services/api/backend';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance, formatPresence } from '@/utils/formatters';

type PillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'default';
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel: string;
};

function ActionPill({
  icon,
  label,
  onPress,
  tone = 'default',
  disabled,
  busy,
  accessibilityLabel,
}: PillProps): React.JSX.Element {
  const { theme } = useTheme();
  const primary = tone === 'primary' && !disabled;
  const fg = primary ? theme.colors.onPrimary : theme.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: primary
            ? pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary
            : pressed
              ? theme.colors.surfacePressed
              : theme.palette.transparent,
          borderColor: primary ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Ionicons name={icon} size={16} color={disabled ? theme.colors.textMuted : fg} />
          <Text
            variant="label"
            numberOfLines={1}
            style={{ color: disabled ? theme.colors.textMuted : fg }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * One person in the Discover list, laid out like a feed post: who they are, what they wrote,
 * their photo, and explicit actions. Only fields the backend returns are shown.
 */
export const ProfilePost = memo(function ProfilePost({
  profile,
  sharedInterests,
  showDistance,
  showPresence,
  onOpen,
  onMessage,
}: {
  profile: ProfileView;
  /** The viewer's interests, used to highlight what they have in common. */
  sharedInterests: string[];
  showDistance: boolean;
  showPresence: boolean;
  onOpen: (profile: ProfileView) => void;
  onMessage: (profile: ProfileView) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const follow = useFollowUser(profile.id);
  const place = (showDistance ? formatDistance(profile.distanceKm) : null) ?? profile.location;
  const meta = [profile.occupation, place].filter(Boolean).join(' · ');
  const presence = showPresence ? formatPresence(profile.presence) : null;
  const photo = profile.photos?.[0] ?? profile.avatarUri;
  const common = profile.interests.filter((interest) => sharedInterests.includes(interest));
  const interests = [
    ...common,
    ...profile.interests.filter((interest) => !common.includes(interest)),
  ].slice(0, 5);
  const open = () => onOpen(profile);

  return (
    <View style={[styles.root, { borderBottomColor: theme.colors.divider }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${profile.name}'s profile`}
        onPress={open}
      >
        <Avatar
          uri={profile.avatarUri}
          label={profile.name}
          size={40}
          online={showPresence && Boolean(profile.presence?.online)}
        />
      </Pressable>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${profile.name}${profile.age > 0 ? `, ${profile.age}` : ''}. ${meta}. Open profile`}
          onPress={open}
          style={styles.header}
        >
          <View style={styles.nameRow}>
            <Text variant="subheading" numberOfLines={1} style={styles.name}>
              {profile.name}
            </Text>
            {profile.age > 0 ? (
              <Text variant="subheading" color="secondary" weight="regular">
                {profile.age}
              </Text>
            ) : null}
          </View>
          {meta || presence ? (
            <Text variant="caption" color="muted" numberOfLines={1}>
              {[presence, meta].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Pressable>

        {profile.relationship.status === 'incoming' ? (
          <View style={[styles.tag, { backgroundColor: theme.colors.primarySoft }]}>
            <Ionicons name="heart" size={12} color={theme.colors.primaryText} />
            <Text variant="caption" color="primary">
              Wants to connect with you
            </Text>
          </View>
        ) : null}

        {profile.bio ? (
          <Text numberOfLines={4} style={styles.bio}>
            {profile.bio}
          </Text>
        ) : null}

        {photo ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${profile.name}'s photo. Open profile`}
            onPress={open}
            style={[styles.photo, { backgroundColor: theme.colors.surfaceMuted }]}
          >
            <FitImage uri={mediaUrl(photo)} recyclingKey={`${profile.id}-${photo}`} />
          </Pressable>
        ) : null}

        {interests.length ? (
          <View style={styles.chips}>
            {interests.map((interest) => (
              <Chip
                key={interest}
                label={interest}
                size="sm"
                selected={common.includes(interest)}
              />
            ))}
            {common.length ? (
              <Text variant="caption" color="primary" style={styles.common}>
                {common.length} in common
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <ActionPill
            tone="primary"
            icon={follow.requested ? 'checkmark' : 'heart-outline'}
            label={follow.requested ? 'Requested' : 'Follow'}
            accessibilityLabel={
              follow.requested ? `Follow request sent to ${profile.name}` : `Follow ${profile.name}`
            }
            disabled={follow.requested}
            busy={follow.pending}
            onPress={follow.follow}
          />
          <ActionPill
            icon="chatbubble-outline"
            label="Message"
            accessibilityLabel={`Message ${profile.name}`}
            onPress={() => onMessage(profile)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${profile.name}'s full profile`}
            hitSlop={6}
            onPress={open}
            style={({ pressed }) => [
              styles.chevron,
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, minWidth: 0, gap: spacing.sm },
  header: { gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  name: { flexShrink: 1 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  bio: { marginTop: -spacing.xxs },
  photo: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  common: { marginLeft: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    minHeight: spacing.touch,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chevron: {
    marginLeft: 'auto',
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
