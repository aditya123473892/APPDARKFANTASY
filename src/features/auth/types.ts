import type { User as BackendUser } from './userModel';
export type { User, UserSummary, Role } from './userModel';
export type LoginStrategy = 'email_password' | 'invite_code' | 'phone_otp' | 'social';
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_IN_USE'
  | 'INVITE_REQUIRED'
  | 'INVITE_INVALID'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'BLOCKED'
  | 'UNVERIFIED'
  | 'NETWORK'
  | 'SERVER'
  | 'ACCOUNT_UNAVAILABLE'
  | 'UNKNOWN';

export type UserView = {
  id: string;
  email: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  avatarUri: string;
  /** Optional, backwards-compatible profile fields. */
  location?: string;
  distanceKm?: number;
  photos?: string[];
  occupation?: string;
};

export type Session = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  userId: string;
};
export type AuthResult = { user: BackendUser; session: Session };
export type LoginInput = { email: string; password: string; strategy: 'email_password' };
export type RegisterInput = {
  name: string;
  lastName: string;
  age: string;
  gender: string;
  email: string;
  password: string;
  inviteCode?: string;
};

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message = 'Authentication failed',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
