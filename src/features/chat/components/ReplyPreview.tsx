import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';

export type ReplyPreviewData = { name: string; text: string };
export function ReplyPreview({
  name,
  text,
  mine = false,
}: ReplyPreviewData & { mine?: boolean }): React.JSX.Element {
  const { theme } = useTheme();
  const color = mine ? theme.colors.onPrimary : theme.colors.primaryText;
  return (
    <View
      accessibilityLabel={`Reply to ${name}: ${text}`}
      style={[styles.preview, { borderLeftColor: color }]}
    >
      <Text variant="caption" weight="semibold" style={{ color }}>
        {name}
      </Text>
      <Text
        variant="caption"
        numberOfLines={2}
        style={{ color: mine ? theme.colors.onPrimary : theme.colors.textMuted }}
      >
        {text}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  preview: {
    borderLeftWidth: 3,
    borderRadius: radius.tail,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
});
