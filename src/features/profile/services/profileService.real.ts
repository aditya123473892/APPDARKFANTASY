import type { User } from '@/features/auth/userModel';
import { toUserView, displayName } from '@/features/auth/userModel';
import { userCache } from '@/features/auth/userCache';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import type { ProfileView } from '../types';
import type { ProfileService } from './profileService';
import { uploadPhoto } from '@/services/api/photoUpload';
import { isPeerBlocked } from '@/features/safety/blockState';

type PublicProfile = Pick<User, '_id'> & Partial<User>;
export function mapProfile(user: PublicProfile): ProfileView {
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
  const users = await getCollection<PublicProfile>('/users', 'users');
  return users
    .filter((u) => u._id !== sessionIdentity.userId && !u.isBlocked && !isPeerBlocked(u._id))
    .map(mapProfile);
}
export const realProfileService: ProfileService = {
  discover: listRealUsers,
  async discoverPage(skip, search) {
    const limit = 20;
    const data = await getData<{ users: PublicProfile[]; count: number }>('/users', {
      skip,
      limit,
      sortBy: '_id',
      order: 'desc',
      ...(search ? { displayname: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } : {}),
    });
    if (!Array.isArray(data.users) || !Number.isFinite(data.count) || data.count < 0)
      throw new ServiceError('UNKNOWN');
    // Advance by server rows, including self/blocked rows filtered from the UI.
    const next = skip + data.users.length;
    return {
      profiles: data.users
        .filter((u) => u._id !== sessionIdentity.userId && !u.isBlocked && !isPeerBlocked(u._id))
        .map(mapProfile),
      nextSkip: data.users.length && next < data.count ? next : undefined,
    };
  },
  async get(id) {
    if (isPeerBlocked(id)) throw new ServiceError('NOT_FOUND');
    // The server evaluates visibility for the authenticated caller.
    const { user } = await getData<{ user: PublicProfile }>(`/users/${id}`);
    if (isPeerBlocked(id)) throw new ServiceError('NOT_FOUND');
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
  async updateAvatar(asset) {
    try {
      const uploadId = await uploadPhoto(asset);
      const response = await apiClient.put('/users/me/avatar', { uploadId });
      const { user } = unwrap<{ user: User }>(response.data);
      return mapProfile(user);
    } catch (error) {
      throw serviceError(error);
    }
  },
};
