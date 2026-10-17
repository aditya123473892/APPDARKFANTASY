import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

// TEMPORARY: set to false after screenshot sharing/testing to restore protection.
export const ALLOW_SCREENSHOTS_FOR_TESTING = true;

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
