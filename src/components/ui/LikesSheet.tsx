import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { mockSocialUsers } from '@/features/feed/mockSocial';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Avatar } from './Avatar';
import { Pressable } from './Pressable';
import { SocialSheet } from './SocialSheet';
import { Text } from './Text';
/** The API exposes a like count only; people/follow state here are local previews. */
export function LikesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [following, setFollowing] = useState<string[]>([]);
  return (
    <SocialSheet visible={visible} onClose={onClose} title="Likes">
      <Text variant="caption" weight="regular" color="muted" center>
        Preview people · follow changes stay on this device
      </Text>
      <FlatList
        data={mockSocialUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              height: 64,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Avatar uri={item.avatarUri} label={item.name} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>
                {item.handle}
              </Text>
              <Text variant="caption" weight="regular" color="muted" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`${following.includes(item.id) ? 'Unfollow' : 'Follow'} ${item.name}`}
              onPress={() =>
                setFollowing((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
              style={{
                backgroundColor: following.includes(item.id)
                  ? theme.colors.surfaceMuted
                  : theme.colors.primary,
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
                justifyContent: 'center',
              }}
            >
              <Text
                weight="semibold"
                style={{
                  fontSize: 12,
                  color: following.includes(item.id) ? theme.colors.text : theme.colors.onPrimary,
                }}
              >
                {following.includes(item.id) ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SocialSheet>
  );
}
