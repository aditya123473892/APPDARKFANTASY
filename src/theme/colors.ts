export const palette = {
  black: '#000000', white: '#FFFFFF', pink: '#FF2D87', pinkLight: '#FF6FB5',
  pinkDark: '#E0176F', green: '#3DDC97', red: '#FF4D5E', amber400: '#FFB84D',
  blue400: '#55A7FF', violet50: '#FFF0F7', violet200: '#FFB8D7', violet400: '#FF6FB5',
  violet500: '#FF2D87', violet600: '#E0176F', pink400: '#FF2D87', green400: '#3DDC97',
  red400: '#FF4D5E', ink950: '#000000', ink900: '#0F0F12', ink800: '#17171C',
  ink700: '#24242B', ink500: '#5E5E68', ink300: '#9A9AA3', ink100: '#F5F5F7',
  transparent: 'transparent',
} as const;

export const darkColors = {
  background: '#000000', surface: '#0F0F12', surfaceMuted: '#17171C', surfaceElevated: '#17171C',
  text: '#F5F5F7', textPrimary: '#F5F5F7', textSecondary: '#9A9AA3', textMuted: '#5E5E68',
  border: 'rgba(255,255,255,0.08)', divider: 'rgba(255,255,255,0.08)',
  thread: 'rgba(255,255,255,0.12)', primary: '#FF2D87', primaryPressed: '#E0176F',
  primarySoft: 'rgba(255,45,135,0.14)', success: '#3DDC97', danger: '#FF4D5E',
  overlay: 'rgba(0,0,0,0.76)', tabBar: '#000000',
  overlayTransparent: 'rgba(0,0,0,0)', overlayStrong: 'rgba(0,0,0,0.88)',
} as const;

export const lightColors = darkColors;
export const accentGradient = ['#FF2D87', '#FF6FB5'] as const;
