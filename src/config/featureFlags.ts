import { env } from './env';

export const featureFlags = {
  AUTH_MODE: env.authMode,
  ENABLE_SOCIAL_LOGIN: false,
  ENABLE_SUPER_LIKE: true,
  // Enable only with a backend that enforces message TTL and atomic view-once access.
  ENABLE_EPHEMERAL_CHAT: process.env.EXPO_PUBLIC_CHAT_EPHEMERAL_ENABLED === 'true',
} as const;
