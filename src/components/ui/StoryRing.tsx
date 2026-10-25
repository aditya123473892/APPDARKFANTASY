import type { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function StoryRing({
  children,
  size,
  unseen = true,
}: PropsWithChildren<{ size: number; unseen?: boolean }>) {
  const { theme } = useTheme();
  return (
    <LinearGradient
      colors={
        unseen
          ? [theme.colors.primary, '#B65BFF', '#FF9BBD']
          : [theme.colors.border, theme.colors.border]
      }
      style={{ width: size, height: size, borderRadius: radius.full, padding: 2 }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: radius.full,
          padding: 2,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
}
