import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatRelativeTime } from '@/utils/formatters';
import type { AppNotification, NotificationKind } from '../types';

const kindIcon: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  connection: 'heart',
  request: 'person-add',
  like: 'flame',
  reply: 'chatbubble',
  message: 'mail',
};

export const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const time = formatRelativeTime(item.createdAt);
  const sentence = `${item.actor.name}${item.kind === 'connection' ? ':' : ''} ${item.text}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'New. '}${sentence}. ${time}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.root,
        {
          backgroundColor: pressed
            ? theme.colors.surfacePressed
            : item.read
              ? theme.colors.surface
              : theme.colors.surfaceElevated,
          borderColor: item.read ? theme.colors.divider : theme.colors.border,
        },
      ]}
    >
      <View>
        <Avatar uri={item.actor.avatarUri} label={item.actor.name} size={48} />
        <View
          style={[
            styles.kind,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface },
          ]}
        >
          <Ionicons name={kindIcon[item.kind]} size={11} color={theme.colors.onPrimary} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text variant="label" weight="regular" numberOfLines={3}>
          <Text variant="label" weight="semibold">
            {item.actor.name}
            {item.kind === 'connection' ? ': ' : ' '}
          </Text>
          {item.text}
        </Text>
        <Text variant="caption" color={item.read ? 'muted' : 'primary'}>
          {time}
        </Text>
      </View>
      {item.read ? (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      ) : (
        <View
          accessibilityLabel="Unread"
          style={[styles.unread, { backgroundColor: theme.colors.primary }]}
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kind: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: spacing.xs },
  unread: { width: 9, height: 9, borderRadius: radius.full },
});
