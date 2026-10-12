import { createContext, type PropsWithChildren, useMemo, useState } from 'react';

import { darkTheme, type AppTheme } from './index';

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
  const isDark = true;
  const value = useMemo(
    () => ({ theme: darkTheme, mode, isDark, setMode }),
    [isDark, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
