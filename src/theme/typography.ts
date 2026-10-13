export const typography = {
  fontFamily: undefined,
  size: { xs: 12, sm: 14, md: 15, lg: 17, xl: 20, xxl: 28, display: 34 },
  lineHeight: { xs: 16, sm: 19, md: 22, lg: 23, xl: 26, xxl: 34, display: 40 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '700' },
  letterSpacing: { tight: -0.5, normal: 0 },
  /** Upper bound for system font scaling so layouts stay intact at large accessibility sizes. */
  maxFontScale: 1.6,
} as const;
