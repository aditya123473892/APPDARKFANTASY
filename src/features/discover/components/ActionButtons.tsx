import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  action: 'pass' | 'super' | 'like';
};
export function ActionButtons({
  onAction,
}: {
  onAction: (action: Action['action']) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const actions: Action[] = [
    { icon: 'close', label: 'Pass', color: theme.colors.danger, action: 'pass' },
    { icon: 'star', label: 'Super like', color: theme.palette.blue400, action: 'super' },
    { icon: 'heart', label: 'Like', color: theme.colors.primary, action: 'like' },
  ];
  return (
    <View style={styles.row}>
      {actions.map((item) => (
        <Pressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => onAction(item.action)}
          style={({ pressed }) => [
            styles.button,
            theme.shadows.sm,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons name={item.icon} color={item.color} size={item.action === 'super' ? 25 : 31} />
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  button: {
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
