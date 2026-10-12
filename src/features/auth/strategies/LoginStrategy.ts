import type { LoginStrategy } from '../types';

export type LoginStrategyConfig = {
  id: LoginStrategy;
  enabled: boolean;
  route: '/login' | '/invite-code';
};
