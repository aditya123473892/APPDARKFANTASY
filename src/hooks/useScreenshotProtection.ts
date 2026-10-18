import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

// Development allows screenshots by default; production always blocks them.
// Set the development flag to false to test capture protection locally.
export const ALLOW_SCREENSHOTS_FOR_TESTING =
  __DEV__ && process.env.EXPO_PUBLIC_ALLOW_SCREENSHOTS_FOR_TESTING !== 'false';

export function useScreenshotProtection(key: string, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const operation = ALLOW_SCREENSHOTS_FOR_TESTING
      ? ScreenCapture.allowScreenCaptureAsync
      : ScreenCapture.preventScreenCaptureAsync;
    void operation(key).catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [key, enabled]);
}
