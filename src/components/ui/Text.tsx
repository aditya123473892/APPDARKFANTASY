import { forwardRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: 'default' | 'muted' | 'primary' | 'danger';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  center?: boolean;
};

export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', color = 'default', weight, center, style, ...props },
  ref,
) {
  const { theme } = useTheme();
  const colorValue = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    primary: theme.colors.primary,
    danger: theme.colors.danger,
  }[color];
  return (
    <RNText
      ref={ref}
      allowFontScaling
      style={[
        styles.base,
        styles[variant],
        {
          color: colorValue,
          fontWeight: weight ? theme.typography.weight[weight] : styles[variant].fontWeight,
        },
        center && styles.center,
        style,
      ]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  base: { fontFamily: undefined },
  display: { fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  center: { textAlign: 'center' },
});
