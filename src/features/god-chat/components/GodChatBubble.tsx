import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import type { GodChatMessage } from '../godChatService';

/** Shared by the member's chat and the admin transcript; `mine` picks the right-hand side. */
export function GodChatBubble({
  message,
  mine,
  label,
}: {
  message: Pick<GodChatMessage, 'role' | 'content'>;
  mine: boolean;
  label?: string;
}): React.JSX.Element {
  const { theme } = useTheme();
  if (message.role === 'event')
    return (
      <Text variant="caption" color="muted" center style={styles.event}>
        {message.content}
      </Text>
    );
  return (
    <View
      style={[
        styles.bubble,
        mine
          ? [styles.mine, { backgroundColor: theme.colors.primary }]
          : [styles.theirs, { backgroundColor: theme.colors.bubbleIn }],
      ]}
    >
      {label ? (
        <Text
          variant="label"
          style={[styles.sender, { color: mine ? theme.colors.onPrimary : theme.colors.primary }]}
        >
          {label}
        </Text>
      ) : null}
      <Text selectable style={{ color: mine ? theme.colors.onPrimary : theme.colors.text }}>
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: radius.sm },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: radius.sm },
  sender: { marginBottom: spacing.none },
  event: { alignSelf: 'center', paddingHorizontal: spacing.lg },
});
