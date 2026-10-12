import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { Message } from '@/mocks/chats';
import { formatMessageTime } from '@/utils/formatters';
import { useTheme } from '@/theme/useTheme';
export const MessageBubble = memo(function MessageBubble({
  message,
  sent,
}: {
  message: Message;
  sent: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, sent && styles.sentRow]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: sent ? theme.colors.primary : theme.colors.surfaceMuted },
        ]}
      >
        <Text style={{ color: sent ? theme.palette.white : theme.colors.text }}>
          {message.text}
        </Text>
        <Text
          variant="caption"
          style={[styles.time, { color: sent ? theme.palette.violet50 : theme.colors.textMuted }]}
        >
          {formatMessageTime(message.createdAt)}
          {sent ? `  ${message.status === 'read' ? '✓✓' : '✓'}` : ''}
        </Text>
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  sentRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  time: { alignSelf: 'flex-end' },
});
