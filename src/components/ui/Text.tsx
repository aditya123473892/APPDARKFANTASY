import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type TextVariant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption';
type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: 'default' | 'secondary' | 'muted' | 'primary' | 'danger' | 'success' | 'inverse' | 'gold';
  serif?: boolean;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  center?: boolean;
};

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(function Text(
  { variant = 'body', color = 'default', weight, center, serif, style, ...props },
  ref,
) {
  const { theme } = useTheme();
  const colorValue = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    primary: theme.colors.primaryText,
    gold: theme.colors.gold,
    danger: theme.colors.danger,
    success: theme.colors.success,
    inverse: theme.colors.onPrimary,
  }[color];
  return (
    <RNText
      ref={ref}
      allowFontScaling
      maxFontSizeMultiplier={typography.maxFontScale}
      style={[
        styles[variant],
        {
          color: colorValue,
          fontFamily: serif
            ? typography.headingFamily
            : typography.family[
                weight ??
                  (variant === 'title' || variant === 'display'
                    ? 'bold'
                    : variant === 'heading'
                      ? 'semibold'
                      : variant === 'label' || variant === 'subheading'
                        ? 'semibold'
                        : variant === 'caption'
                          ? 'medium'
                          : 'regular')
              ],
          fontWeight: undefined,
        },
        center && styles.center,
        style,
      ]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  display: {
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    letterSpacing: typography.letterSpacing.tight,
  },
  title: {
    fontSize: typography.size.xxl,
    lineHeight: typography.lineHeight.xxl,
    letterSpacing: typography.letterSpacing.tight,
  },
  heading: { fontSize: typography.size.xl, lineHeight: typography.lineHeight.xl },
  subheading: { fontSize: typography.size.lg, lineHeight: typography.lineHeight.lg },
  body: { fontSize: typography.size.md, lineHeight: typography.lineHeight.md },
  label: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.sm },
  caption: { fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs },
  center: { textAlign: 'center' },
});
