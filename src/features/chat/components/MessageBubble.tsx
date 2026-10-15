import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatMessageTime } from '@/utils/formatters';
import type { ChatMessage } from '../hooks/useChat';
import { ChatAttachment } from './ChatAttachment';

const statusLabel: Record<ChatMessage['status'], string> = {
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Not delivered',
};

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  first,
  last,
  onDiscard,
}: {
  message: ChatMessage;
  mine: boolean;
  /** First/last in a run of consecutive messages from the same sender — controls corner shape and spacing. */
  first: boolean;
  last: boolean;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const failed = message.status === 'failed';
  const time = formatMessageTime(message.createdAt);

  const openFailedActions = (): void => {
    if (!message.clientId) return;
    const clientId = message.clientId;
    Alert.alert(
      'Send status unknown',
      'Refresh the conversation before sending again. The server may already have received this message.',
      [
        { text: 'Dismiss local copy', style: 'destructive', onPress: () => onDiscard(clientId) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const statusIcon =
    message.status === 'sending'
      ? 'time-outline'
      : message.status === 'sent'
        ? 'checkmark'
        : message.status === 'failed'
          ? 'alert-circle'
          : 'checkmark-done';
  const statusColor =
    message.status === 'read'
      ? theme.colors.secondary
      : failed
        ? theme.colors.danger
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
        accessibilityLabel={`${mine ? 'You' : 'Them'}: ${message.text}. ${time}${mine ? `. ${statusLabel[message.status]}` : ''}`}
        accessibilityHint={failed ? 'Opens options to retry or delete' : undefined}
        disabled={!failed}
        onPress={openFailedActions}
        style={[
          styles.bubble,
          mine
            ? [
                { backgroundColor: theme.colors.primary },
                !first && styles.mineJoinTop,
                !last && styles.mineJoinBottom,
              ]
            : [
                { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
                styles.theirBubble,
                !first && styles.theirJoinTop,
                !last && styles.theirJoinBottom,
              ],
          failed && { opacity: 0.7 },
        ]}
      >
        {!mine && first && message.senderName ? (
          <Text variant="caption" color="primary">
            {message.senderName}
          </Text>
        ) : null}
        <Text selectable style={{ color: mine ? theme.colors.onPrimary : theme.colors.text }}>
          {message.text}
        </Text>
        {message.media?.map((media) => (
          <ChatAttachment
            key={`${media._id}:${media.expiresAt ?? ''}:${media.status ?? ''}`}
            media={media}
            messageId={message.id}
          />
        ))}
      </Pressable>
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
              <Ionicons name="refresh" size={13} color={theme.colors.danger} />
              <Text variant="caption" color="danger">
                Check send status
              </Text>
            </Pressable>
          ) : (
            <>
              <Text variant="caption" color="muted">
                {message.status === 'sending' ? 'Sending…' : time}
              </Text>
              {mine ? <Ionicons name={statusIcon} size={14} color={statusColor} /> : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
});

const BUBBLE = radius.lg;
const JOIN = radius.xs;
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
