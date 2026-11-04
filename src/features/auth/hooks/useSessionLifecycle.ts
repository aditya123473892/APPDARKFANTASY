import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuthStore } from '../store/authStore';
import { EXPIRY_MARGIN_MS } from '../session';
import { env } from '@/config/env';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';

/** Time away after which roles and account state are checked again on return. */
const PROFILE_RECHECK_MS = 30_000;

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
      const expired =
        env.backgroundTimeoutMinutes > 0 && elapsed >= env.backgroundTimeoutMinutes * 60_000;
      if (store.session && expired) {
        // Keep the content covered until the expired session has been closed.
        void store
          .expire()
          .catch(() => undefined)
          .finally(() => setPrivateScreen(AppState.currentState !== 'active'));
        return;
      }
      // The cover is only for the app-switcher snapshot. Waiting for the profile check
      // blanked the screen after every notification shade, picker or Face ID prompt.
      setPrivateScreen(false);
      if (store.session && elapsed >= PROFILE_RECHECK_MS)
        void store.refreshProfile().catch(() => undefined);
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
