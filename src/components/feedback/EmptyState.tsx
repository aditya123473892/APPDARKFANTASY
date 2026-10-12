import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.base}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={34} color={theme.colors.primary} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      <Text color="muted" center>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
});
