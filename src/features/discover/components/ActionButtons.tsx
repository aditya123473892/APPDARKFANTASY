import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { featureFlags } from '@/config/featureFlags';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import type { SwipeAction } from './CardStack';

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  action: SwipeAction;
  size: number;
};

export function ActionButtons({
  onAction,
  disabled = false,
}: {
  onAction: (action: SwipeAction) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const actions: Action[] = [
    { icon: 'close', label: 'Pass', action: 'pass', size: 64 },
    ...(featureFlags.ENABLE_SUPER_LIKE
      ? [{ icon: 'star', label: 'Super like', action: 'super', size: 52 } as Action]
      : []),
    { icon: 'heart', label: 'Connect', action: 'like', size: 64 },
  ];
  const colorFor = (action: SwipeAction) =>
    action === 'like'
      ? theme.colors.onPrimary
      : action === 'super'
        ? theme.colors.secondary
        : theme.colors.text;
  return (
    <View style={styles.row}>
      {actions.map((item) => (
        <Pressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          disabled={disabled}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction(item.action);
          }}
          style={({ pressed }) => [
            styles.button,
            {
              width: item.size,
              height: item.size,
              backgroundColor:
                item.action === 'like' ? theme.colors.primary : theme.colors.surfaceElevated,
              borderColor: item.action === 'like' ? theme.colors.primary : theme.colors.border,
              opacity: disabled ? 0.4 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            color={colorFor(item.action)}
            size={item.action === 'super' ? 22 : 28}
          />
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  button: {
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
