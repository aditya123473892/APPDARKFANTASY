import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { sanitizeCrashEvent } from './privacy';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
// A DSN is a public ingestion address; authentication tokens belong only in the build environment.
if (!__DEV__ && dsn) {
  Sentry.init({
    dsn,
    environment: 'production',
    sendDefaultPii: false,
    release: `darkfantasy@${Constants.expoConfig?.version ?? 'unknown'}`,
    dist: Constants.expoConfig?.android?.versionCode?.toString(),
    enableLogs: false,
    maxBreadcrumbs: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    enableAutoPerformanceTracing: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeCrashEvent,
    beforeSendTransaction: () => null,
  });
}
export const withCrashReporting = Sentry.wrap;
