import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuthStore } from '../store/authStore';
import { EXPIRY_MARGIN_MS } from '../session';
import { env } from '@/config/env';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';

export function useSessionLifecycle(): boolean {
  const [privateScreen, setPrivateScreen] = useState(AppState.currentState !== 'active');
  const session = useAuthStore((state) => state.session);
  useScreenshotProtection('privacy', Platform.OS === 'android');
  useEffect(() => {
    // Native protection applies before JS receives background notifications.
    if (Platform.OS === 'ios')
      void ScreenCapture.enableAppSwitcherProtectionAsync().catch(() => undefined);
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setPrivateScreen(true);
        if (state === 'background') backgroundAt ??= Date.now();
        return;
      }
      const elapsed = backgroundAt === null ? 0 : Date.now() - backgroundAt;
      backgroundAt = null;
      const store = useAuthStore.getState();
      if (store.session) {
        const action =
          env.backgroundTimeoutMinutes > 0 && elapsed >= env.backgroundTimeoutMinutes * 60_000
            ? store.logout()
            : store.refreshProfile();
        void action
          .catch(() => undefined)
          .finally(() => setPrivateScreen(AppState.currentState !== 'active'));
      } else setPrivateScreen(false);
    });
    return () => {
      subscription.remove();
      if (Platform.OS === 'ios')
        void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now() - EXPIRY_MARGIN_MS;
    const timer = setTimeout(
      () => {
        void useAuthStore
          .getState()
          .expire()
          .catch(() => undefined);
      },
      Math.max(0, Math.min(remaining, 2_147_483_647)),
    );
    return () => clearTimeout(timer);
  }, [session]);
  return privateScreen;
}
