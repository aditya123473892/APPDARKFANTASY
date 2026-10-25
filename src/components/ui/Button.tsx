import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { AnimatedPressable } from './AnimatedPressable';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const inactive = Boolean(disabled || loading);
  const palette = {
    primary: {
      bg: theme.colors.primary,
      pressed: theme.colors.primaryPressed,
      fg: theme.colors.onPrimary,
      border: theme.colors.primary,
    },
    secondary: {
      bg: theme.colors.surfaceElevated,
      pressed: theme.colors.surfacePressed,
      fg: theme.colors.text,
      border: theme.colors.border,
    },
    ghost: {
      bg: theme.palette.transparent,
      pressed: theme.colors.primarySoft,
      fg: theme.colors.primaryText,
      border: theme.palette.transparent,
    },
    danger: {
      bg: theme.colors.dangerSoft,
      pressed: theme.colors.dangerSoft,
      fg: theme.colors.danger,
      border: theme.colors.danger,
    },
    pill: {
      bg: theme.colors.primarySoft,
      pressed: theme.colors.primarySoft,
      fg: theme.colors.primaryText,
      border: theme.palette.transparent,
    },
  }[variant];
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.base,
        styles[size],
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 17 : 19} color={palette.fg} /> : null}
          <Text
            variant="label"
            weight="semibold"
            style={{ color: palette.fg, flexShrink: 1, textAlign: 'center' }}
          >
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 0,
    flexShrink: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sm: { minHeight: spacing.touch, paddingHorizontal: spacing.lg },
  md: { minHeight: spacing.control },
  lg: { minHeight: spacing.control },
  full: { width: '100%' },
});
