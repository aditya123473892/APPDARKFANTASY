import { Ionicons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';
import type { PostAuthor } from '@/features/feed/types';
import { spacing, radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Avatar } from './Avatar';
import { Pressable } from './Pressable';
import { Text } from './Text';

export function StoriesRow({
  users,
  me,
  onOpen,
  onCreate,
}: {
  users: PostAuthor[];
  me: PostAuthor;
  onOpen: (user: PostAuthor) => void;
  onCreate: () => void;
}) {
  const { theme } = useTheme();
  if (!users.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      {[me, ...users].map((user, index) => (
        <Pressable
          key={`${index}-${user.id}`}
          accessibilityLabel={index ? `Open ${user.name}'s story` : 'Create your story'}
          onPress={() => (index ? onOpen(user) : onCreate())}
          style={{ width: 72, alignItems: 'center', gap: spacing.sm }}
        >
          <View>
            <Avatar uri={user.avatarUri} label={user.name} size={64} ring={index > 0} />
            {index === 0 ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: theme.colors.primary,
                  borderRadius: radius.full,
                  borderWidth: 2,
                  borderColor: theme.colors.background,
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.onPrimary} />
              </View>
            ) : null}
          </View>
          <Text variant="caption" weight="regular" numberOfLines={1}>
            {index ? user.handle || user.name : 'Your story'}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
