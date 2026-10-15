import { create } from 'zustand';
import { authService } from '../services';
import { AuthError, type AuthResult, type Session, type UserView as User } from '../types';
import { secureStorage } from '@/services/storage/secureStorage';
import { queryClient } from '@/services/queryClient';
import { useOutbox } from '@/features/chat/store/outboxStore';
import {
  registerSessionInvalidation,
  setRuntimeToken,
  teardownSession,
  registerForbidden,
  setSessionIdentity,
  sessionIdentity,
} from '../sessionRuntime';
import { sessionFromToken } from '../session';
import { parseUser, toUserView, type User as BackendUser, type Role } from '../userModel';
import { userCache } from '../userCache';

let revision = 0;
let profileRevision = 0;
export const getAuthRevision = (): number => revision;
let storageQueue: Promise<unknown> = Promise.resolve();
function persist(operation: () => Promise<void>): Promise<void> {
  const next = storageQueue.then(operation, operation);
  storageQueue = next.catch(() => undefined);
  return next;
}

export type AuthStatus =
  'loading' | 'authenticated' | 'unauthenticated' | 'blocked' | 'unverified' | 'expired';
const accountStatus = (user: BackendUser): AuthStatus =>
  user.isBlocked ? 'blocked' : !user.isEmailVerified ? 'unverified' : 'authenticated';
type AuthState = {
  status: AuthStatus;
  user: User | null;
  currentUser: BackendUser | null;
  roles: Role[];
  tokenPresent: boolean;
  profileError: string | null;
  permissionError: string | null;
  refreshProfile: () => Promise<void>;
  expire: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  session: Session | null;
  hydrate: () => Promise<void>;
  setAuthenticated: (result: AuthResult) => Promise<void>;
  logout: () => Promise<void>;
  /** Refreshes the authoritative profile after a profile edit. */
  updateUser: (user: User) => void;
  beginLogin: () => number;
  sessionRevision: number;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  currentUser: null,
  roles: [],
  tokenPresent: false,
  profileError: null,
  permissionError: null,
  session: null,
  sessionRevision: 0,
  beginLogin: () => ++revision,
  hydrate: async () => {
    const current = ++revision;
    set({ status: 'loading' });
    try {
      await storageQueue;
      const token = await secureStorage.getSession();
      if (current !== revision) return;
      if (!token) {
        await get().logout();
        return;
      }
      const session = sessionFromToken(token);
      setRuntimeToken(token);
      const user = await authService.getCurrentUser(session);
      if (current === revision) {
        parseUser(user);
        setSessionIdentity(user._id, token);
        userCache.put(user);
        set({
          status: accountStatus(user),
          session,
          currentUser: user,
          user: toUserView(user),
          roles: user.roles,
          tokenPresent: true,
          profileError: null,
        });
      }
    } catch (error) {
      // Fail closed; no cached profile is rendered while validation is unavailable.
      if (current === revision) {
        await get().logout();
        if (error instanceof AuthError && error.code === 'BLOCKED') set({ status: 'blocked' });
        else if (error instanceof AuthError && error.code === 'SESSION_EXPIRED')
          set({ status: 'expired' });
        else
          set({
            status: 'unverified',
            profileError: 'Unable to load your profile. Please sign in again.',
          });
      }
    }
  },
  setAuthenticated: async ({ session, user }) => {
    parseUser(user);
    const current = revision;
    sessionFromToken(session.accessToken);
    await persist(() => secureStorage.setSession(session.accessToken));
    if (current !== revision) return;
    if (sessionIdentity.userId && sessionIdentity.userId !== user._id) {
      void queryClient.cancelQueries();
      queryClient.clear();
      useOutbox.getState().clear();
    }
    setSessionIdentity(user._id, session.accessToken);
    userCache.put(user);
    set((state) => ({
      status: accountStatus(user),
      session,
      currentUser: user,
      user: toUserView(user),
      roles: user.roles,
      tokenPresent: true,
      profileError: null,
      permissionError: null,
      sessionRevision: state.sessionRevision + 1,
    }));
  },
  logout: async () => {
    ++revision;
    teardownSession();
    void queryClient.cancelQueries();
    queryClient.clear();
    useOutbox.getState().clear();
    set((state) => ({
      status: 'unauthenticated',
      session: null,
      user: null,
      currentUser: null,
      roles: [],
      tokenPresent: false,
      profileError: null,
      permissionError: null,
      sessionRevision: state.sessionRevision + 1,
    }));
    // No backend logout exists. Always clear memory even if Keychain deletion fails.
    await persist(() => secureStorage.clearSession());
  },
  // Fixture profile edits never become authoritative identity or authorization data.
  updateUser: () => {
    void get().refreshProfile();
  },
  login: async (email, password) => {
    const attempt = get().beginLogin();
    const result = await authService.login({ email, password, strategy: 'email_password' });
    if (attempt === revision) await get().setAuthenticated(result);
  },
  expire: async () => {
    await get().logout();
    set({ status: 'expired' });
  },
  refreshProfile: async () => {
    const session = get().session;
    if (!session) return;
    const current = revision;
    const request = ++profileRevision;
    try {
      const user = parseUser(await authService.getCurrentUser(session));
      if (current !== revision || request !== profileRevision) return;
      const changed = JSON.stringify(get().roles) !== JSON.stringify(user.roles);
      userCache.put(user);
      set((state) => ({
        currentUser: user,
        user: toUserView(user),
        roles: user.roles,
        status: accountStatus(user),
        profileError: null,
        sessionRevision: state.sessionRevision + (changed ? 1 : 0),
      }));
    } catch (error) {
      if (error instanceof AuthError && error.code === 'BLOCKED') {
        // /auth/me rejects blocked accounts without returning a profile.
        if (current === revision && request === profileRevision) {
          await get().logout();
          set({ status: 'blocked' });
        }
        return;
      }
      if (current !== revision || request !== profileRevision) return;
      set({
        currentUser: null,
        user: null,
        roles: [],
        status: 'unverified',
        profileError: 'Unable to load your profile. Retry to continue.',
      });
    }
  },
}));
registerSessionInvalidation(async (blocked) => {
  await useAuthStore.getState().logout();
  useAuthStore.setState({ status: blocked ? 'blocked' : 'expired' });
});
let refreshingForbidden: Promise<void> | null = null;
registerForbidden(async () => {
  useAuthStore.setState({ permissionError: 'You are not permitted to perform this action.' });
  refreshingForbidden ??= useAuthStore
    .getState()
    .refreshProfile()
    .finally(() => {
      refreshingForbidden = null;
    });
  await refreshingForbidden;
});
