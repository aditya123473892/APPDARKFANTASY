import { accentGradient, darkColors, lightColors, palette } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

type ThemeColors = { [Key in keyof typeof lightColors]: string };
export type AppTheme = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  typography: typeof typography;
  palette: typeof palette;
};
export const lightTheme: AppTheme = {
  colors: lightColors,
  spacing,
  radius,
  shadows,
  typography,
  palette,
};
export const darkTheme: AppTheme = {
  colors: darkColors,
  spacing,
  radius,
  shadows,
  typography,
  palette,
};

export { accentGradient, palette, radius, shadows, spacing, typography };
