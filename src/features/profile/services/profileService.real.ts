import type { User } from '@/features/auth/userModel';
import { toUserView, displayName } from '@/features/auth/userModel';
import { userCache } from '@/features/auth/userCache';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import type { ProfileView } from '../types';
import type { ProfileService } from './profileService';

export function mapProfile(user: User): ProfileView {
  if (!user || !/^[a-f\d]{24}$/i.test(user._id)) throw new ServiceError('UNKNOWN');
  userCache.put(user);
  return {
    ...toUserView(user),
    name: displayName(user),
    avatarUri: mediaUrl(user.avatar),
    photos: user.avatar ? [mediaUrl(user.avatar)] : [],
    presence:
      typeof user.isOnline === 'boolean'
        ? { online: user.isOnline, lastSeenAt: user.lastSeen ?? null }
        : null,
    relationship: { status: 'none' },
  };
}
export async function listRealUsers(): Promise<ProfileView[]> {
  const users = await getCollection<User>('/users', 'users');
  return users.filter((u) => u._id !== sessionIdentity.userId && !u.isBlocked).map(mapProfile);
}
export const realProfileService: ProfileService = {
  discover: listRealUsers,
  async get(id) {
    // The server evaluates visibility for the authenticated caller.
    const { user } = await getData<{ user: User }>(`/users/${id}`);
    return mapProfile(user);
  },
  async updateMe(input) {
    // Only schema/DTO-backed fields; no fabricated occupation or combined location field.
    try {
      const response = await apiClient.patch('/users/me', {
        displayname: input.name,
        bio: input.bio,
        intrests: input.interests,
      });
      const { user } = unwrap<{ user: User }>(response.data);
      return mapProfile(user);
    } catch (error) {
      throw serviceError(error);
    }
  },
};
