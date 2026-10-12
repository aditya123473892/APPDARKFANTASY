import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Loader } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator(): React.JSX.Element {
  const { isDark } = useTheme();
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'authenticated' && inAuth) router.replace('/discover');
    else if (status === 'unauthenticated' && !inAuth) router.replace('/welcome');
    void SplashScreen.hideAsync();
  }, [router, segments, status]);
  if (status === 'loading') return <Loader label="Preparing your space…" />;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
