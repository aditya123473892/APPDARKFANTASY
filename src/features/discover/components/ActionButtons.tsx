import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
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
  unavailableActions = [],
}: {
  onAction: (action: SwipeAction) => void;
  disabled?: boolean;
  unavailableActions?: readonly SwipeAction[];
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
        ? theme.colors.gold
        : theme.colors.text;
  return (
    <View style={styles.row}>
      {actions.map((item) => (
        <AnimatedPressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ disabled: disabled || unavailableActions.includes(item.action) }}
          accessibilityHint={
            disabled || unavailableActions.includes(item.action)
              ? 'Open the profile to see available connection options'
              : undefined
          }
          disabled={disabled || unavailableActions.includes(item.action)}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction(item.action);
          }}
          style={[
            styles.button,
            {
              width: item.size,
              height: item.size,
              backgroundColor:
                item.action === 'like' ? theme.colors.primary : theme.colors.surfaceElevated,
              borderColor: item.action === 'like' ? theme.colors.primary : theme.colors.border,
              opacity: disabled || unavailableActions.includes(item.action) ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name={item.icon} color={colorFor(item.action)} size={24} />
        </AnimatedPressable>
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
