import { featureFlags } from '@/config/featureFlags';
import type { LoginStrategyConfig } from './LoginStrategy';

export const loginStrategies: LoginStrategyConfig[] = [
  { id: 'email_password', enabled: featureFlags.AUTH_MODE === 'open', route: '/login' },
  { id: 'invite_code', enabled: featureFlags.AUTH_MODE === 'invite_only', route: '/invite-code' },
];

export function getPrimaryLoginStrategy(): LoginStrategyConfig {
  return loginStrategies.find((strategy) => strategy.enabled) ?? loginStrategies[0]!;
}
