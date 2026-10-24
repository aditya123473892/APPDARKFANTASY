import type { UserView } from './types';

export const ROLES = ['root', 'admin', 'user', 'manager', 'moderator'] as const;
export type Role = (typeof ROLES)[number];
/** JSON fields returned by Users schema. Dates are serialized ISO strings. */
export type User = {
  _id: string;
  username: string;
  displayname: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  isEmailVerified: boolean;
  isBlocked: boolean;
  blockedBy?: 'open' | 'admin' | 'system';
  status?: 'open' | 'blocked';
  blockedTime?: string;
  phoneNumber?: string;
  /** Verified sign-in number (E.164); set with phoneVerifiedAt. */
  phoneE164?: string;
  phoneVerifiedAt?: string;
  gender?: string;
  age?: number;
  avatar?: string;
  bio?: string;
  posts?: number;
  followers?: number;
  following?: number;
  isOnline?: boolean;
  lastSeen?: string;
  loginCount?: number;
  lastLogin?: string;
  loginAttempts?: number;
  intrests?: string[];
  passwordResetToken?: string;
  passwordResetTokenUsed?: boolean;
  verifyEmailToken?: string;
  canEditProfile?: boolean;
  city?: string;
  state?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};
export type UserSummary = Pick<User, '_id'> &
  Partial<Pick<User, 'displayname' | 'avatar' | 'username' | 'firstName' | 'lastName'>>;
export const displayName = (user: UserSummary): string =>
  user.displayname || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member';
export const initials = (user: UserSummary): string =>
  displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
export const avatarUrl = (user: UserSummary): string => user.avatar ?? '';
/** Compatibility presentation model for the existing fixture-based screens. */
export function toUserView(user: Pick<User, '_id'> & Partial<User>): UserView {
  return {
    id: user._id,
    email: user.username ?? '',
    name: displayName(user),
    age: user.age ?? 0,
    bio: user.bio ?? '',
    avatarUri: avatarUrl(user),
    interests: user.intrests ?? [],
    location: [user.city, user.state, user.country].filter(Boolean).join(', '),
  };
}
export function parseUser(value: unknown): User {
  const user = value as User;
  if (
    !user ||
    typeof user._id !== 'string' ||
    !user._id ||
    typeof user.username !== 'string' ||
    !Array.isArray(user.roles) ||
    !user.roles.length ||
    user.roles.some((role) => !ROLES.includes(role)) ||
    typeof user.isEmailVerified !== 'boolean' ||
    typeof user.isBlocked !== 'boolean'
  )
    throw new Error('Profile unavailable or unsupported roles');
  return user;
}
