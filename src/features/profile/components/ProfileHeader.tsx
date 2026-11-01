import { View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import type { UserView } from '@/features/auth/types';
import { spacing } from '@/theme';
import { Pressable } from '@/components/ui/Pressable';

export function ProfileHeader({
  user,
  posts = 0,
  followers,
  following,
  presence,
  distance,
  onFollowersPress,
  onFollowingPress,
}: {
  user: UserView;
  posts?: number;
  followers?: number;
  following?: number;
  presence?: string | null;
  distance?: string | null;
  centered?: boolean;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar uri={user.avatarUri} label={user.name} size={96} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' }}>
          {[
            { value: posts, label: 'Posts', onPress: undefined },
            { value: followers, label: 'Followers', onPress: onFollowersPress },
            { value: following, label: 'Following', onPress: onFollowingPress },
          ].map(({ value, label, onPress }) => (
            <Pressable key={label} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${value ?? ''} ${label}`} style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
              <Text
                weight="semibold"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ fontSize: 18, fontVariant: ['tabular-nums'] }}
              >
                {typeof value === 'number' ? value.toLocaleString() : '—'}
              </Text>
              <Text
                variant="caption"
                weight="regular"
                color="muted"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>
          {user.name}
        </Text>
        {user.bio ? (
          <Text numberOfLines={4} style={{ fontSize: 14 }}>
            {user.bio}
          </Text>
        ) : null}
        {presence || distance ? (
          <Text variant="caption" weight="regular" color="muted">
            {[presence, distance].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
