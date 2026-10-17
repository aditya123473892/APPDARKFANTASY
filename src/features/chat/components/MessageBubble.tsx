import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
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
        style={[
          styles.bubble,
          mine
            ? [
                { backgroundColor: theme.colors.primary },
                !first && styles.mineJoinTop,
                styles.mineJoinBottom,
              ]
            : [
                { backgroundColor: theme.colors.bubbleIn, borderColor: theme.colors.border },
                styles.theirBubble,
                !first && styles.theirJoinTop,
                styles.theirJoinBottom,
              ],
          failed && { borderWidth: 1, borderColor: theme.colors.danger },
        ]}
      >
        {replyPreview ? <ReplyPreview {...replyPreview} mine={mine} /> : null}
        {!mine && first && message.senderName ? (
          <Text variant="caption" color="primary">
            {message.senderName}
          </Text>
        ) : null}
        <Text selectable style={{ color: mine ? theme.colors.onPrimary : theme.colors.text }}>
          {message.text}
        </Text>
        {message.viewOnce && message.media?.[0] ? (
          <ViewOnceAttachment
            media={message.media[0]}
            messageId={message.id}
            mine={mine}
            viewedAt={message.viewedAt}
          />
        ) : (
          message.media?.map((media) => (
            <ChatAttachment
              key={`${media._id}:${media.expiresAt ?? ''}:${media.status ?? ''}`}
              media={media}
              messageId={message.id}
            />
          ))
        )}
        {message.expiresAt && !message.viewOnce ? (
          <ExpiryCountdown
            expiresAt={message.expiresAt}
            color={mine ? theme.colors.onPrimary : theme.colors.textMuted}
          />
        ) : null}
        {last || failed ? (
          <View style={[styles.meta, mine && styles.metaMine]}>
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
                  size={18}
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
                <Text
                  variant="caption"
                  style={{ color: mine ? theme.colors.onPrimary : theme.colors.textMuted }}
                >
                  {message.status === 'sending' ? 'Sending…' : time}
                </Text>
                {mine && (!group || message.local) ? (
                  <Ionicons name={statusIcon} size={14} color={statusColor} />
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
});

const BUBBLE = radius.bubble;
const JOIN = radius.tail;
const styles = StyleSheet.create({
  row: { maxWidth: '100%' },
  mineRow: { alignItems: 'flex-end', paddingLeft: '18%' },
  theirRow: { alignItems: 'flex-start', paddingRight: '18%' },
  grouped: { marginBottom: 2 },
  groupEnd: { marginBottom: spacing.md },
  bubble: {
    maxWidth: 560,
    borderRadius: BUBBLE,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  theirBubble: { borderWidth: StyleSheet.hairlineWidth },
  mineJoinTop: { borderTopRightRadius: JOIN },
  mineJoinBottom: { borderBottomRightRadius: JOIN },
  theirJoinTop: { borderTopLeftRadius: JOIN },
  theirJoinBottom: { borderBottomLeftRadius: JOIN },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  metaMine: { justifyContent: 'flex-end' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 24 },
});
