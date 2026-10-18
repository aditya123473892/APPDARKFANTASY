import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

// TEMPORARY: set to false after screenshot sharing/testing to restore protection.
export const ALLOW_SCREENSHOTS_FOR_TESTING =
  __DEV__ && process.env.EXPO_PUBLIC_ALLOW_SCREENSHOTS_FOR_TESTING === 'true';

export function useScreenshotProtection(key: string, enabled = true, force = false): void {
  useEffect(() => {
    if (!enabled) return;
    const operation = ALLOW_SCREENSHOTS_FOR_TESTING && !force
      ? ScreenCapture.allowScreenCaptureAsync
      : ScreenCapture.preventScreenCaptureAsync;
    void operation(key).catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [key, enabled, force]);
}
