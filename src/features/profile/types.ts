import type { UserView as User } from '@/features/auth/types';
import type { Presence, Relationship } from '@/types';

export type ProfileView = User & { relationship: Relationship; followers?: number; following?: number; presence: Presence | null };

export type UpdateProfileInput = {
  name: string;
  bio: string;
  location?: string;
  occupation?: string;
  interests: string[];
};
