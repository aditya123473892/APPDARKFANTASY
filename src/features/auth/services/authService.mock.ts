import { currentUser } from '@/mocks/users';
import { MOCK_DELAY_MS } from '@/utils/constants';
import type { AuthService } from './authService';
import {
  AuthError,
  type AuthResult,
  type LoginInput,
  type RegisterInput,
  type Session,
} from '../types';
import type { User } from '../userModel';
const fixtureUser: User = {
  _id: currentUser.id,
  username: currentUser.email,
  displayname: currentUser.name,
  firstName: 'Alex',
  lastName: 'Morgan',
  roles: ['user'],
  isBlocked: false,
  isEmailVerified: true,
  intrests: currentUser.interests,
  avatar: currentUser.avatarUri,
};

const wait = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
const createSession = (userId: string): Session => ({
  accessToken: `mock_access_${userId}`,
  refreshToken: `mock_refresh_${userId}`,
  userId,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
});

export const mockAuthService: AuthService = {
  async login(input: LoginInput): Promise<AuthResult> {
    await wait();
    if (input.email === 'error@example.com' || input.password === 'wrongpass')
      throw new AuthError('INVALID_CREDENTIALS');
    return {
      user: { ...fixtureUser, username: input.email },
      session: createSession(fixtureUser._id),
    };
  },
  async register(input: RegisterInput): Promise<AuthResult> {
    await wait();
    if (input.email === 'taken@example.com') throw new AuthError('EMAIL_IN_USE');
    const user = { ...fixtureUser, displayname: input.name, username: input.email };
    return { user, session: createSession(user._id) };
  },
  async logout(): Promise<void> {
    await wait();
  },
  async refreshSession(refreshToken: string): Promise<Session> {
    await wait();
    if (!refreshToken.startsWith('mock_refresh_')) throw new AuthError('SESSION_EXPIRED');
    return createSession(refreshToken.replace('mock_refresh_', ''));
  },
  async getCurrentUser(session: Session): Promise<User> {
    await wait();
    if (!session.accessToken.startsWith('mock_access_')) throw new AuthError('SESSION_EXPIRED');
    return fixtureUser;
  },
  async requestPasswordReset(_email: string): Promise<void> {
    await wait();
  },
  async validateInviteCode(code: string): Promise<boolean> {
    await wait();
    return code.trim().toUpperCase() === 'NIGHT42';
  },
};
