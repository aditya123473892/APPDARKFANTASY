import 'react-native-reanimated';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { Loader, ToastHost, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useSessionLifecycle } from '@/features/auth/hooks/useSessionLifecycle';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { useToastStore } from '@/components/ui/Toast';

void SplashScreen.preventAutoHideAsync();

function RootNavigator(): React.JSX.Element {
  const { theme } = useTheme();
  const privateScreen = useSessionLifecycle();
  const sessionRevision = useAuthStore((state) => state.sessionRevision);
  const status = useAuthStore((state) => state.status);
  const permissionError = useAuthStore((state) => state.permissionError);
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydratePreferences = usePreferences((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    return registerSessionTeardown(() => useToastStore.getState().hide());
  }, []);
  useEffect(() => {
    void hydrate();
    void hydratePreferences();
  }, [hydrate, hydratePreferences]);
  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'authenticated' && inAuth) router.replace('/home');
    else if (status === 'unauthenticated' && !inAuth) router.replace('/login');
    else if (
      ['blocked', 'unverified', 'expired'].includes(status) &&
      segments[0] !== 'account-state'
    )
      router.replace('/account-state');
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
          key={sessionRevision}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Protected guard={status === 'authenticated'}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'unauthenticated'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Screen name="index" />
          <Stack.Screen name="account-state" />
          <Stack.Screen name="not-allowed" />
        </Stack>
      )}
      {/* Keep toasts clear of the tab bar on tab screens. */}
      <ToastHost key={`toast-${sessionRevision}`} bottomOffset={inTabs ? spacing.tabBar : 0} />
      {permissionError && (
        <View
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            right: 20,
            padding: 16,
            backgroundColor: theme.colors.surfaceElevated,
          }}
        >
          <Text onPress={() => useAuthStore.setState({ permissionError: null })}>
            {permissionError}
          </Text>
        </View>
      )}
      {privateScreen ? (
        <View
          accessibilityLabel="Private"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.colors.background,
          }}
        />
      ) : null}
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
