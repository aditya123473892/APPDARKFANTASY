import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'danger';
  compact?: boolean;
};

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
  tone = 'default',
  compact = false,
}: EmptyStateProps): React.JSX.Element {
  const { theme } = useTheme();
  const accent = tone === 'danger' ? theme.colors.danger : theme.colors.textSecondary;
  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor:
              tone === 'danger' ? theme.colors.dangerSoft : theme.colors.surfaceMuted,
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={accent} />
      </View>
      <Text variant="subheading" center>
        {title}
      </Text>
      <Text color="secondary" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === 'danger' ? 'secondary' : 'primary'}
          size="sm"
          fullWidth={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  compact: { minHeight: 180, flex: 0 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  message: { maxWidth: 320 },
  action: { marginTop: spacing.md },
});
