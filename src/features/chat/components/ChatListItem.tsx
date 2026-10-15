import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Text, Skeleton } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatRelativeTime } from '@/utils/formatters';
import type { Conversation } from '../types';

export const ChatListItem = memo(function ChatListItem({
  conversation,
  myId,
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
    ? `${conversation.kind === 'group' ? `${fromMe ? 'You' : lastMessage.senderName || 'Someone'}: ` : fromMe ? 'You: ' : ''}${lastMessage.text}`
    : conversation.kind === 'group'
      ? `${conversation.memberCount ?? 0} members · Open group`
      : 'Open conversation';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${participant.name}. ${unread ? `${unreadCount} unread. ` : ''}${preview}`}
      onPress={() => onPress(conversation)}
      style={({ pressed }) => [styles.root, pressed && { backgroundColor: theme.colors.surface }]}
    >
      <Avatar uri={participant.avatarUri} label={participant.name} size={56} />
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
          {conversation.previewState === 'loading' ? (
            <Skeleton style={{ width: '70%', height: 14 }} />
          ) : (
            <Text
              numberOfLines={1}
              variant="label"
              weight={unread ? 'semibold' : 'regular'}
              color={unread ? 'default' : lastMessage ? 'secondary' : 'primary'}
              style={styles.preview}
            >
              {conversation.previewState === 'error'
                ? 'Preview unavailable · pull to refresh'
                : preview}
            </Text>
          )}
          {fromMe && conversation.kind !== 'group' ? (
            <Ionicons
              name={lastMessage?.status === 'read' ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={lastMessage?.status === 'read' ? theme.colors.primary : theme.colors.textMuted}
            />
          ) : null}
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
