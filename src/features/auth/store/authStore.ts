import { create } from 'zustand';
import { authService } from '../services';
import type { AuthResult, Session, User } from '../types';
import { secureStorage } from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AuthState = {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  hydrate: () => Promise<void>;
  setAuthenticated: (result: AuthResult) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  session: null,
  hydrate: async () => {
    try {
      const raw = await secureStorage.getSession();
      if (!raw) {
        set({ status: 'unauthenticated' });
        return;
      }
      const session = JSON.parse(raw) as Session;
      const user = await authService.getCurrentUser(session);
      set({ status: 'authenticated', session, user });
    } catch {
      await secureStorage.clearSession();
      set({ status: 'unauthenticated', session: null, user: null });
      logger.debug('Stored session was invalid and has been cleared');
    }
  },
  setAuthenticated: async ({ session, user }) => {
    await secureStorage.setSession(JSON.stringify(session));
    set({ status: 'authenticated', session, user });
  },
  logout: async () => {
    try {
      await authService.logout();
    } finally {
      await secureStorage.clearSession();
      set({ status: 'unauthenticated', session: null, user: null });
    }
  },
}));
