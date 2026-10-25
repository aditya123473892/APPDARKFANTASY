import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Avatar, Button, Chip, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatTimeAgo } from '@/utils/formatters';
import { useBlock } from '@/features/safety/useBlock';
import type { ConnectionRequest } from '../types';

export const RequestCard = memo(function RequestCard({
  request,
  busy,
  disabled,
  onOpenProfile,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: ConnectionRequest;
  /** This row's action is in flight. */
  busy: boolean;
  /** Another action is in flight — block taps to avoid racing requests. */
  disabled: boolean;
  onOpenProfile: (request: ConnectionRequest) => void;
  onAccept: (request: ConnectionRequest) => void;
  onDecline: (request: ConnectionRequest) => void;
  onCancel: (request: ConnectionRequest) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const block = useBlock();
  const { user } = request;
  const incoming = request.direction === 'incoming';
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${user.name}'s profile`}
        onPress={() => onOpenProfile(request)}
        style={styles.top}
      >
        <Avatar uri={user.avatarUri} label={user.name} size={56} ring={request.superLike} />
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text variant="subheading" numberOfLines={1} style={styles.name}>
              {user.name}, {user.age}
            </Text>
            {request.superLike ? (
              <View style={[styles.superTag, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="star" size={11} color={theme.colors.primary} />
                <Text variant="caption" color="primary">
                  Super like
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {[user.occupation, user.location].filter(Boolean).join(' · ')}
          </Text>
          <Text variant="caption" color="muted">
            {incoming ? 'Requested' : 'Sent'} {formatTimeAgo(request.createdAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      </Pressable>
      {request.note ? (
        <View
          style={[
            styles.note,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text variant="label" weight="regular" color="secondary">
            “{request.note}”
          </Text>
        </View>
      ) : null}
      {user.interests.length ? (
        <View style={styles.chips}>
          {user.interests.slice(0, 3).map((interest) => (
            <Chip key={interest} label={interest} size="sm" />
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {incoming ? (
          <>
            <Button
              label="Decline"
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onPress={() => onDecline(request)}
              style={styles.action}
              accessibilityLabel={`Decline ${user.name}'s request`}
            />
            <Button
              label="Accept"
              icon="heart"
              size="sm"
              loading={busy}
              disabled={disabled}
              onPress={() => onAccept(request)}
              style={styles.action}
              accessibilityLabel={`Accept ${user.name}'s request`}
            />
            <Button
              label="Block"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              onPress={() => block.confirm(user.id)}
              accessibilityLabel={`Block ${user.name}`}
            />
          </>
        ) : (
          <Button
            label="Cancel request"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={disabled}
            onPress={() => onCancel(request)}
            accessibilityLabel={`Cancel your request to ${user.name}`}
          />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  superTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.none,
    borderRadius: radius.full,
  },
  note: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
