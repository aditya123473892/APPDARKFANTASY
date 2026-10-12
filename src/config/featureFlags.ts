import { env } from './env';

export const featureFlags = {
  AUTH_MODE: env.authMode,
  ENABLE_SOCIAL_LOGIN: false,
  ENABLE_SUPER_LIKE: true,
} as const;
