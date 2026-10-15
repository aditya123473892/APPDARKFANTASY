import Constants from 'expo-constants';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:9000/api' : '');
const parsed = new URL(apiUrl);
if (
  !['http:', 'https:'].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password ||
  parsed.search ||
  parsed.hash
)
  throw new Error('Invalid API URL configuration');
if (!__DEV__ && parsed.protocol !== 'https:') throw new Error('Release API must use HTTPS');
export const env = {
  apiUrl: apiUrl.replace(/\/$/, ''),
  authMode:
    (process.env.EXPO_PUBLIC_AUTH_MODE ?? Constants.expoConfig?.extra?.authMode) === 'invite_only'
      ? ('invite_only' as const)
      : ('open' as const),
  backgroundTimeoutMinutes: Math.max(
    0,
    Number(process.env.EXPO_PUBLIC_AUTH_BACKGROUND_TIMEOUT_MINUTES) || 0,
  ),
  pinningEnabled: process.env.EXPO_PUBLIC_SSL_PINNING_ENABLED === 'true',
  pins: (process.env.EXPO_PUBLIC_SSL_PINS ?? '')
    .split(',')
    .map((pin) => pin.trim())
    .filter(Boolean),
};
