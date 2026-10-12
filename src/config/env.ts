import Constants from 'expo-constants';

type AppEnv = { apiUrl: string; authMode: 'open' | 'invite_only' };

function parseAuthMode(value: unknown): AppEnv['authMode'] {
  return value === 'invite_only' ? 'invite_only' : 'open';
}

export const env: AppEnv = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  authMode: parseAuthMode(
    process.env.EXPO_PUBLIC_AUTH_MODE ?? Constants.expoConfig?.extra?.authMode,
  ),
};
