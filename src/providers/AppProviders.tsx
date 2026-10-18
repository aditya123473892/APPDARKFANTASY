import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/services/queryClient';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { startSync } from '@/features/vault/sync';
import { cleanupStartup } from '@/features/vault/files';
import { registerLocalVaultLifecycle } from '@/features/auth/localVaultLifecycle';
import { beforeLogout } from '@/features/vault/logout';
import { lock } from '@/features/vault/lock';
import { localOwner, rememberOwner } from '@/features/vault/vaultService';
import { VaultPasscodePrompt } from '@/features/vault/components/VaultPasscodePrompt';
registerLocalVaultLifecycle({
  logout: beforeLogout,
  pause: lock,
  signIn: async (owner) => {
    const previous = await localOwner();
    if (previous && previous !== owner) await beforeLogout();
    lock();
    await rememberOwner(owner);
  },
});

/** Lets TanStack Query pause polling in the background and refetch stale data on resume. */
function useAppFocusManager(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onChange = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, []);
}

export function AppProviders({ children }: PropsWithChildren): React.JSX.Element {
  useAppFocusManager();
  useEffect(() => {
    void cleanupStartup().catch(() => undefined);
    return startSync();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            <VaultPasscodePrompt />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
