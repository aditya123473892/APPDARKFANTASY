import 'react-native-reanimated';
import { withCrashReporting } from '@/services/monitoring/crashReporting';
import { useNotificationLifecycle } from '@/features/activity/useNotificationLifecycle';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { ServerWakeBanner } from '@/components/feedback/ServerWakeBanner';
import { wakeServer } from '@/services/api/serverWake';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useAgeConsent } from '@/features/legal/ageConsentStore';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { DialogHost, Loader, ToastHost, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useSessionLifecycle } from '@/features/auth/hooks/useSessionLifecycle';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { useToastStore } from '@/components/ui/Toast';
import { useDialogStore } from '@/components/ui/dialogStore';

/** Routes anyone can open whatever their sign-in state. */
const OPEN_ROUTES = ['vault', 'about', 'legal', 'age-check'];

void SplashScreen.preventAutoHideAsync();
// Start waking the backend while the splash screen shows, and again on return from a
// long background spell; requests wait for it either way.
void wakeServer();
AppState.addEventListener('change', (state) => {
  if (state === 'active') void wakeServer();
});

function RootNavigator(): React.JSX.Element {
  const { theme, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const privateScreen = useSessionLifecycle();
  useNotificationLifecycle(true);
  const sessionRevision = useAuthStore((state) => state.sessionRevision);
  const status = useAuthStore((state) => state.status);
  const permissionError = useAuthStore((state) => state.permissionError);
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydratePreferences = usePreferences((state) => state.hydrate);
  const ageConsent = useAgeConsent((state) => state.status);
  const hydrateAgeConsent = useAgeConsent((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    return registerSessionTeardown(() => {
      useToastStore.getState().hide();
      useDialogStore.getState().clear();
    });
  }, []);
  useEffect(() => {
    // Unlocking remounts protected navigation; the established session is already hydrated.
    if (useAuthStore.getState().status === 'loading') void hydrate();
    void hydratePreferences();
    void hydrateAgeConsent();
  }, [hydrate, hydratePreferences, hydrateAgeConsent]);
  useEffect(() => {
    if (status === 'loading' || ageConsent === 'unknown') return;
    const first = (segments as string[])[0] ?? '';
    const inAuth = first === '(auth)';
    // Legal pages stay readable from the 18+ check and while signed out.
    if (ageConsent === 'required') {
      if (!['age-check', 'legal'].includes(first)) router.replace('/age-check' as Href);
    } else if (status === 'authenticated' && inAuth) router.replace('/home');
    else if (status === 'unauthenticated' && !inAuth && !OPEN_ROUTES.includes(first))
      // Welcome offers both sign-in and sign-up; Login alone hid account creation.
      router.replace('/welcome');
    else if (
      ['blocked', 'unverified', 'expired'].includes(status) &&
      first !== 'account-state' &&
      !OPEN_ROUTES.includes(first)
    )
      router.replace('/account-state');
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [router, segments, status, ageConsent, fontsLoaded, fontError]);
  useEffect(() => {
    // A slow sign-in check (the server may be waking up) shows the in-app loader and
    // wake banner after a moment, instead of a splash that looks frozen.
    if (status !== 'loading' || (!fontsLoaded && !fontError)) return;
    const timer = setTimeout(() => void SplashScreen.hideAsync(), 1500);
    return () => clearTimeout(timer);
  }, [status, fontsLoaded, fontError]);
  const inTabs = (segments as string[])[1] === '(tabs)';
  if (!fontsLoaded && !fontError)
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Edge-to-edge: the status bar is transparent and draws over our dark background. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {status === 'loading' || ageConsent === 'unknown' ? (
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
          <Stack.Screen name="age-check" options={{ gestureEnabled: false }} />
          <Stack.Screen name="legal" />
          <Stack.Screen name="about" />
          <Stack.Screen name="vault" />
        </Stack>
      )}
      {/* Keep toasts clear of the tab bar on tab screens. */}
      <ToastHost key={`toast-${sessionRevision}`} bottomOffset={inTabs ? spacing.tabBar : 0} />
      <DialogHost />
      <ServerWakeBanner />
      {permissionError && (
        <View
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            right: 20,
            padding: spacing.lg,
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

function RootLayout(): React.JSX.Element {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
export default withCrashReporting(RootLayout);
