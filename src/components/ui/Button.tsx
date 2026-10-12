import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { accentGradient, radius, spacing } from '@/theme';
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
  style?: ViewStyle;
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
  const backgrounds = {
    primary: theme.palette.transparent,
    secondary: theme.palette.transparent,
    ghost: theme.palette.transparent,
    danger: theme.colors.danger,
    pill: theme.colors.primarySoft,
  };
  const foreground =
    variant === 'primary' || variant === 'danger'
      ? theme.palette.white
      : variant === 'secondary'
        ? theme.colors.text
        : theme.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={() => { void Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        { backgroundColor: backgrounds[variant], borderColor: variant === 'secondary' ? theme.colors.border : theme.palette.transparent, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        fullWidth && styles.full,
        style,
      ]}
    >
      {variant === 'primary' ? <LinearGradient colors={accentGradient} style={StyleSheet.absoluteFill} /> : null}
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={foreground} /> : null}
          <Text variant="label" weight="bold" style={{ color: foreground }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: spacing.touch,
    borderRadius: radius.full,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  sm: { height: 44 },
  md: { height: 50 },
  lg: { height: 56 },
  full: { width: '100%' },
});
