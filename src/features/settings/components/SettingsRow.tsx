import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  value,
  onValueChange,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  danger?: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const toggle = typeof value === 'boolean';
  return (
    <Pressable
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityState={toggle ? { checked: value } : undefined}
      onPress={toggle ? () => onValueChange?.(!value) : onPress}
      style={styles.row}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: danger ? `${theme.colors.danger}18` : theme.colors.primarySoft },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? theme.colors.danger : theme.colors.primary}
        />
      </View>
      <View style={styles.copy}>
        <Text weight="semibold" color={danger ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {toggle ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={theme.palette.white}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
