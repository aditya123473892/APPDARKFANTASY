import { View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import type { UserView } from '@/features/auth/types';
import { spacing } from '@/theme';

export function ProfileHeader({
  user,
  posts = 0,
  followers,
  following,
  presence,
  distance,
}: {
  user: UserView;
  posts?: number;
  followers?: number;
  following?: number;
  presence?: string | null;
  distance?: string | null;
  centered?: boolean;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar uri={user.avatarUri} label={user.name} size={96} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' }}>
          {[
            [posts, 'Posts'],
            [followers, 'Followers'],
            [following, 'Following'],
          ].map(([value, label]) => (
            <View key={label} style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
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
            </View>
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
