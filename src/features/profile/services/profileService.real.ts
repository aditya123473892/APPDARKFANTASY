import type { User } from '@/features/auth/userModel';
import { toUserView, displayName } from '@/features/auth/userModel';
import { userCache } from '@/features/auth/userCache';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { apiClient } from '@/services/api/apiClient';
import {
  getCollection,
  getData,
  getDataShared,
  mediaUrl,
  unwrap,
  serviceError,
} from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import type { ProfileView } from '../types';
import type { ProfileService } from './profileService';
import { uploadPhoto } from '@/services/api/photoUpload';
import { isPeerBlocked } from '@/features/safety/blockState';

import { queryClient } from '@/services/queryClient';
import { relationshipKey, relationshipChanging, type FollowRelationship } from '@/features/requests/relationship';
type PublicProfile = Pick<User, '_id'> & Partial<User> & { relationship?: FollowRelationship };
export function mapProfile(user: PublicProfile): ProfileView {
  if (!user || !/^[a-f\d]{24}$/i.test(user._id)) throw new ServiceError('UNKNOWN');
  userCache.put(user);
  if (user.relationship && !relationshipChanging.has(`${sessionIdentity.generation}:${user._id}`)) queryClient.setQueryData(relationshipKey(user._id), user.relationship);
  return {
    ...toUserView(user),
    followers: user.followers, following: user.following,
    name: displayName(user),
    avatarUri: mediaUrl(user.avatar),
    avatarThumbUri: mediaUrl(user.avatarThumbnail) || undefined,
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
  async discoverPage(skip, search, signal) {
    const limit = 20;
    const data = await getData<{ users: PublicProfile[]; count: number }>('/users', {
      summary: 'true',
      skip,
      limit,
      sortBy: '_id',
      order: 'desc',
      ...(search ? { displayname: search } : {}),
    }, signal);
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
    // Shared with the profile's post list, which reads the same endpoint at the same time.
    const { user } = await getDataShared<{ user: PublicProfile }>(`/users/${id}`);
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
