import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Avatar, Text, Skeleton } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, media } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import type { Conversation } from '../types';

export const CHAT_AVATAR = media.avatar.large;

export const ChatListItem = memo(function ChatListItem({
  conversation,
  myId,
  showPresence,
  pinned = false,
  muted = false,
  onPress,
}: {
  conversation: Conversation;
  myId: string;
  showPresence: boolean;
  pinned?: boolean;
  muted?: boolean;
  onPress: (conversation: Conversation) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const { participant, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;
  const isGroup = conversation.kind === 'group';
  const fromMe = lastMessage?.senderId === myId;
  const sender = lastMessage
    ? isGroup
      ? `${fromMe ? 'You' : lastMessage.senderName || 'Someone'}: `
      : fromMe
        ? 'You: '
        : ''
    : '';
  const body = lastMessage
    ? lastMessage.text
    : isGroup
      ? `${conversation.memberCount ?? 0} members · Open group`
      : 'Open conversation';
  const preview = `${sender}${body}`;
  const failedPreview = conversation.previewState === 'error';
  const badgeColor = muted ? theme.colors.textMuted : theme.colors.primary;
  const date = new Date(conversation.updatedAt);
  const time = Number.isFinite(date.getTime())
    ? date.toDateString() === new Date().toDateString()
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${participant.name}. ${unread ? `${unreadCount} unread. ` : ''}${preview}`}
      onPress={() => onPress(conversation)}
      android_ripple={{ color: theme.colors.surfacePressed }}
      style={({ pressed }) => [
        styles.root,
        pressed && { backgroundColor: theme.colors.surfacePressed },
      ]}
    >
      <Avatar
        uri={participant.avatarUri}
        label={participant.name}
        size={CHAT_AVATAR}
        online={showPresence && Boolean(conversation.presence?.online)}
      />
      <View style={styles.content}>
        <View style={styles.row}>
          {isGroup ? (
            <Ionicons
              accessibilityLabel="Group"
              name="people"
              size={14}
              color={theme.colors.textSecondary}
            />
          ) : null}
          <Text weight="semibold" numberOfLines={1} style={styles.name}>
            {participant.name}
          </Text>
          {muted ? (
            <Ionicons
              accessibilityLabel="Muted"
              name="volume-mute"
              size={14}
              color={theme.colors.textMuted}
            />
          ) : null}
          {fromMe && !isGroup ? (
            <Ionicons
              accessibilityLabel={lastMessage?.status === 'read' ? 'Read' : 'Sent'}
              name={lastMessage?.status === 'read' ? 'checkmark-done' : 'checkmark'}
              size={16}
              color={
                lastMessage?.status === 'read' ? theme.colors.primaryText : theme.colors.textMuted
              }
            />
          ) : null}
          <Text variant="caption" color={unread && !muted ? 'primary' : 'muted'}>
            {time}
          </Text>
        </View>
        <View style={styles.row}>
          {conversation.previewState === 'loading' ? (
            <View style={styles.preview}>
              <Skeleton style={styles.previewSkeleton} />
            </View>
          ) : (
            <Text
              numberOfLines={1}
              color={failedPreview ? 'muted' : unread ? 'default' : 'secondary'}
              style={styles.preview}
            >
              {failedPreview ? (
                'Preview unavailable · pull to refresh'
              ) : (
                <>
                  {sender ? (
                    <Text color={unread ? 'default' : 'secondary'} weight="medium">
                      {sender}
                    </Text>
                  ) : null}
                  <Text color={unread ? 'default' : lastMessage ? 'secondary' : 'primary'}>
                    {body}
                  </Text>
                </>
              )}
            </Text>
          )}
          {pinned && !unread ? (
            <Ionicons
              accessibilityLabel="Pinned"
              name="pin"
              size={15}
              color={theme.colors.textMuted}
            />
          ) : null}
          {unread ? (
            <View
              accessibilityLabel={`${unreadCount} unread`}
              style={[styles.badge, { backgroundColor: badgeColor }]}
            >
              <Text
                weight="semibold"
                style={{ fontSize: 11, lineHeight: 16, color: theme.colors.onPrimary }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
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
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flex: 1, fontSize: 16 },
  preview: { flex: 1, fontSize: 14 },
  previewSkeleton: { width: '70%', height: 14 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
