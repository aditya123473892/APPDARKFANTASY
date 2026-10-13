import 'react-native-reanimated';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { Loader, ToastHost } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydratePreferences = usePreferences((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    void hydrate();
    void hydratePreferences();
  }, [hydrate, hydratePreferences]);
  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'authenticated' && inAuth) router.replace('/discover');
    else if (status === 'unauthenticated' && !inAuth) router.replace('/welcome');
    void SplashScreen.hideAsync();
  }, [router, segments, status]);
  const inTabs = (segments as string[])[1] === '(tabs)';
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Edge-to-edge: the status bar is transparent and draws over our dark background. */}
      <StatusBar style="light" />
      {status === 'loading' ? (
        <Loader label="Preparing your space…" />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
      )}
      {/* Keep toasts clear of the tab bar on tab screens. */}
      <ToastHost bottomOffset={inTabs ? spacing.tabBar : 0} />
    </View>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
