import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function AttachmentCard({
  title,
  description,
  label,
  icon,
  mine,
  once,
  loading,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  mine?: boolean;
  once?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: mine ? theme.colors.primarySoft : theme.colors.surface,
          opacity: disabled ? 0.65 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.icon,
          { borderColor: theme.colors.primaryText, borderStyle: once ? 'dashed' : 'solid' },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <Ionicons name={icon} size={22} color={theme.colors.primaryText} />
        )}
        {once ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryText }]}>
            <Text
              weight="semibold"
              style={{ fontSize: 10, lineHeight: 14, color: theme.colors.surface }}
            >
              1
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>
          {title}
        </Text>
        <Text variant="caption" weight="regular" color="muted" numberOfLines={2}>
          {description}
        </Text>
      </View>
      {!disabled && !loading ? (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    width: 248,
    maxWidth: '100%',
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    marginVertical: spacing.xs,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
