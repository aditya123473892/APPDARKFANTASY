import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function SettingsGroup({
  title,
  children,
}: React.PropsWithChildren<{ title?: string }>): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="label" color="muted" style={styles.groupTitle}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  value,
  onValueChange,
  danger = false,
  loading = false,
  last = false,
  external = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  danger?: boolean;
  loading?: boolean;
  /** Hides the divider under the final row of a group. */
  last?: boolean;
  external?: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const toggle = typeof value === 'boolean';
  return (
    <Pressable
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={toggle ? { checked: value } : { busy: loading }}
      disabled={loading}
      onPress={toggle ? () => onValueChange?.(!value) : onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfacePressed },
      ]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: danger ? theme.colors.dangerSoft : theme.colors.primarySoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={danger ? theme.colors.danger : theme.colors.primary}
        />
      </View>
      <View
        style={[
          styles.body,
          !last && {
            borderBottomColor: theme.colors.divider,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={styles.copy}>
          <Text variant="label" weight="medium" color={danger ? 'danger' : 'default'}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : toggle ? (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.palette.white}
            ios_backgroundColor={theme.colors.border}
          />
        ) : danger ? null : (
          <Ionicons
            name={external ? 'open-outline' : 'chevron-forward'}
            size={18}
            color={theme.colors.textMuted}
          />
        )}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.xs },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingVertical: spacing.sm,
  },
  copy: { flex: 1, gap: 2 },
});
