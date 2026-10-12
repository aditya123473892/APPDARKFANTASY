import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Text } from '@/components/ui';
import type { Chat } from '@/mocks/chats';
import type { User } from '@/features/auth/types';
import { formatRelativeTime } from '@/utils/formatters';

export const ChatListItem = memo(function ChatListItem({
  chat,
  user,
  onPress,
}: {
  chat: Chat;
  user: User;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${user.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.root, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Avatar uri={user.avatarUri} label={user.name} online={chat.online} size={58} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text weight="bold">{user.name}</Text>
          <Text variant="caption" color="muted">
            {formatRelativeTime(chat.updatedAt)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text numberOfLines={1} color={chat.typing ? 'primary' : 'muted'} style={styles.preview}>
            {chat.typing ? 'Typing…' : chat.lastMessage}
          </Text>
          {chat.unreadCount ? <Badge value={chat.unreadCount} /> : null}
        </View>
      </View>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  root: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { flex: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  preview: { flex: 1 },
});
