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
          fontFamily:
            (serif ?? ['display', 'title', 'heading'].includes(variant))
              ? typography.headingFamily
              : typography.family[
                  weight ??
                    (variant === 'label' || variant === 'subheading'
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
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  center: { textAlign: 'center' },
});
