import type { ViewStyle } from 'react-native';
const flat: ViewStyle = { elevation: 0, shadowOpacity: 0 };
export const shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = { sm: flat, md: flat, lg: flat };
