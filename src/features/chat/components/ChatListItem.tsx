import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatRelativeTime } from '@/utils/formatters';
import type { Conversation } from '../types';

export const ChatListItem = memo(function ChatListItem({
  conversation,
  myId,
  showPresence,
  onPress,
}: {
  conversation: Conversation;
  myId: string;
  showPresence: boolean;
  onPress: (conversation: Conversation) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const { participant, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;
  const fromMe = lastMessage?.senderId === myId;
  const preview = lastMessage
    ? `${fromMe ? 'You: ' : ''}${lastMessage.text}`
    : 'New connection — say hello 👋';
  const online = showPresence && Boolean(conversation.presence?.online);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${participant.name}. ${unread ? `${unreadCount} unread. ` : ''}${preview}`}
      onPress={() => onPress(conversation)}
      style={({ pressed }) => [styles.root, pressed && { backgroundColor: theme.colors.surface }]}
    >
      <Avatar uri={participant.avatarUri} label={participant.name} online={online} size={56} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text
            variant="subheading"
            weight={unread ? 'bold' : 'semibold'}
            numberOfLines={1}
            style={styles.name}
          >
            {participant.name}
          </Text>
          <Text variant="caption" color={unread ? 'primary' : 'muted'}>
            {formatRelativeTime(conversation.updatedAt)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text
            numberOfLines={1}
            variant="label"
            weight={unread ? 'semibold' : 'regular'}
            color={unread ? 'default' : lastMessage ? 'secondary' : 'primary'}
            style={styles.preview}
          >
            {preview}
          </Text>
          {unread ? <Badge value={unreadCount} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  content: { flex: 1, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { flex: 1 },
  preview: { flex: 1 },
});
