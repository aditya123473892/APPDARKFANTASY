import { createContext, type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { darkTheme, lightTheme, type AppTheme } from './index';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const systemMode = useColorScheme();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync('velvet-noir.appearance')
      .then((saved) => {
        if (mounted && (saved === 'dark' || saved === 'light' || saved === 'system'))
          setMode(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (hydrated)
      void SecureStore.setItemAsync('velvet-noir.appearance', mode).catch(() => undefined);
  }, [hydrated, mode]);
  const isDark = mode === 'system' ? systemMode !== 'light' : mode === 'dark';
  const value = useMemo(
    () => ({ theme: isDark ? darkTheme : lightTheme, mode, isDark, setMode }),
    [isDark, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
