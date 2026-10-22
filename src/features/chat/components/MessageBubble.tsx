import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { useBlockState } from '@/features/safety/blockState';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatMessageTime } from '@/utils/formatters';
import type { ChatMessage } from '../hooks/useChat';
import { ChatAttachment } from './ChatAttachment';
import { ExpiryCountdown } from './ExpiryCountdown';
import { previewText } from '../services/chatPayload';
import { ViewOnceAttachment } from './ViewOnceAttachment';
import { ReplyPreview, type ReplyPreviewData } from './ReplyPreview';

const statusLabel: Record<ChatMessage['status'], string> = {
  sending: 'Sending',
  sent: 'Sent',

  read: 'Read',
  'failed-definitive': 'Rejected by server',
  uncertain: 'Send status unknown',
};

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  first,
  last,
  onRetry,
  onResync,
  onActions,
  group,
  replyPreview,
}: {
  message: ChatMessage;
  mine: boolean;
  /** First/last in a run of consecutive messages from the same sender — controls corner shape and spacing. */
  first: boolean;
  last: boolean;
  onRetry: (clientId: string) => void;
  onResync: (clientId: string) => void;
  onActions: (message: ChatMessage) => void;
  group: boolean;
  replyPreview?: ReplyPreviewData;
}): React.JSX.Element {
  const { theme } = useTheme();
  const locallyBlocked = useBlockState((state) => state.ids.includes(message.senderId));
  const blocked = group && !mine && (locallyBlocked || message.blockedSender);
  const failed = message.status === 'failed-definitive' || message.status === 'uncertain';
  const time = formatMessageTime(message.createdAt);

  const openFailedActions = (): void => {
    if (!message.clientId) return;
    const clientId = message.clientId;
    const uncertain = message.status === 'uncertain';
    const canRetry = !uncertain || message.resync === 'absent';
    Alert.alert(
      uncertain ? 'Send status unknown' : 'Server rejected message',
      uncertain
        ? message.resync === 'present'
          ? 'A matching own message exists in the refreshed history. Its identity cannot be proven; sending again is withheld.'
          : 'Refresh history first. Even if absent, sending again may create a duplicate if the original arrives later.'
        : 'The server rejected this message. You can try again.',
      [
        ...(uncertain ? [{ text: 'Resync history', onPress: () => onResync(clientId) }] : []),
        ...(canRetry
          ? [
              {
                text: 'Send again',
                onPress: () =>
                  Alert.alert(
                    'Send again?',
                    uncertain
                      ? 'The refreshed history shows no matching message. The original may still arrive later, so this can create a duplicate.'
                      : 'Send this message again?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Send again', onPress: () => onRetry(clientId) },
                    ],
                  ),
              },
            ]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const statusIcon =
    message.status === 'sending'
      ? 'time-outline'
      : message.status === 'sent'
        ? 'checkmark'
        : failed
          ? 'alert-circle'
          : 'checkmark-done';
  const statusColor =
    message.status === 'read'
      ? theme.colors.onPrimary
      : failed
        ? theme.colors.danger
        : mine
          ? theme.colors.onPrimary
          : theme.colors.textMuted;

  const textColor = mine ? theme.colors.onPrimary : theme.colors.text;
  const metaColor = mine ? theme.colors.onPrimary : theme.colors.textMuted;
  const hasMedia = Boolean(message.media?.length);

  // The server withholds blocked senders' content, so there is nothing to reveal.
  if (blocked)
    return (
      <Pressable
        accessibilityRole="text"
        accessibilityLabel="Message from a blocked user"
        onLongPress={() => onActions(message)}
        style={[styles.bubble, { backgroundColor: theme.colors.bubbleIn, marginBottom: 8 }]}
      >
        <Text color="muted">Message from a blocked user</Text>
      </Pressable>
    );

  return (
    <View
      style={[
        styles.row,
        mine ? styles.mineRow : styles.theirRow,
        last ? styles.groupEnd : styles.grouped,
      ]}
    >
      <Pressable
        accessible
        accessibilityRole={failed ? 'button' : 'text'}
        accessibilityLabel={`${mine ? 'You' : 'Them'}: ${previewText(message)}. ${time}${mine && (!group || message.local) ? `. ${statusLabel[message.status]}` : ''}`}
        accessibilityHint={failed ? 'Opens send-status options' : 'Long press for message actions'}
        onPress={failed ? openFailedActions : undefined}
        onLongPress={() => onActions(message)}
        delayLongPress={320}
        style={[
          styles.bubble,
          mine
            ? [
                { backgroundColor: theme.colors.primary },
                !first && styles.mineJoinTop,
                !last && styles.mineJoinBottom,
                last && styles.mineTail,
              ]
            : [
                { backgroundColor: theme.colors.bubbleIn },
                !first && styles.theirJoinTop,
                !last && styles.theirJoinBottom,
                last && styles.theirTail,
              ],
          failed && { borderWidth: 1, borderColor: theme.colors.danger },
        ]}
      >
        {replyPreview ? <ReplyPreview {...replyPreview} mine={mine} /> : null}
        {!mine && first && message.senderName ? (
          <Text variant="label" color="primary" numberOfLines={1} style={styles.sender}>
            {message.senderName}
          </Text>
        ) : null}
        {message.viewOnce && message.media?.[0] ? (
          <ViewOnceAttachment
            key={`${message.id}:${message.media[0]._id}`}
            media={message.media[0]}
            messageId={message.id}
            mine={mine}
            viewedAt={message.viewedAt}
            viewDurationSeconds={message.viewDurationSeconds}
          />
        ) : (
          message.media?.map((media) => (
            <ChatAttachment
              mine={mine}
              key={`${media._id}:${media.expiresAt ?? ''}:${media.status ?? ''}`}
              media={media}
              messageId={message.id}
            />
          ))
        )}
        {message.expiresAt && !message.viewOnce ? (
          <ExpiryCountdown expiresAt={message.expiresAt} color={metaColor} />
        ) : null}
        {/* Text and time share a wrapping row: short messages keep the time inline, long ones drop it below. */}
        <View style={[styles.content, hasMedia && !message.text && styles.contentMediaOnly]}>
          {message.text ? (
            <Text selectable style={[styles.text, { color: textColor }]}>
              {message.text}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {failed ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Review failed message"
                hitSlop={10}
                onPress={openFailedActions}
                style={styles.retry}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={mine ? theme.colors.onPrimary : theme.colors.danger}
                />
                <Text
                  variant="caption"
                  style={{ color: mine ? theme.colors.onPrimary : theme.colors.danger }}
                >
                  Check send status
                </Text>
              </Pressable>
            ) : (
              <>
                <Text variant="caption" style={[styles.time, { color: metaColor }]}>
                  {message.status === 'sending' ? 'Sending…' : time}
                </Text>
                {mine && (!group || message.local) ? (
                  <Ionicons name={statusIcon} size={15} color={statusColor} />
                ) : null}
              </>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

const BUBBLE = radius.bubble + 2;
const JOIN = radius.tail + 2;
const styles = StyleSheet.create({
  row: { maxWidth: '100%' },
  mineRow: { alignItems: 'flex-end', paddingLeft: '16%' },
  theirRow: { alignItems: 'flex-start', paddingRight: '16%' },
  grouped: { marginBottom: 2 },
  groupEnd: { marginBottom: spacing.sm + 2 },
  bubble: {
    maxWidth: 560,
    borderRadius: BUBBLE,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs + 3,
    paddingBottom: spacing.xs + 1,
  },
  mineJoinTop: { borderTopRightRadius: JOIN },
  mineJoinBottom: { borderBottomRightRadius: JOIN },
  mineTail: { borderBottomRightRadius: radius.tail },
  theirJoinTop: { borderTopLeftRadius: JOIN },
  theirJoinBottom: { borderBottomLeftRadius: JOIN },
  theirTail: { borderBottomLeftRadius: radius.tail },
  sender: { marginBottom: 2 },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: spacing.sm,
  },
  contentMediaOnly: { justifyContent: 'flex-end', marginTop: spacing.xs },
  text: { flexShrink: 1 },
  meta: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
    paddingBottom: 1,
  },
  time: { fontSize: 11, lineHeight: 14, opacity: 0.85 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 24 },
});
