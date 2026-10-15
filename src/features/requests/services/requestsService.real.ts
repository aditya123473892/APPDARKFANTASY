import type { User } from '@/features/auth/userModel';
import { getData, unwrap, serviceError } from '@/services/api/backend';
import { apiClient } from '@/services/api/apiClient';
import { mapProfile } from '@/features/profile/services/profileService.real';
import { ServiceError } from '@/services/errors';
import type { RequestsService } from './requestsService';
type Follow = {
  _id: string;
  follower: User;
  following: User | string;
  createdAt: string;
  status: string;
};
export async function pendingFollows() {
  const { followRequests } = await getData<{ followRequests: Follow[] }>(
    '/users/follow/follow-requests',
  );
  return followRequests;
}
export async function approveFollow(id: string, status: 'accepted' | 'rejected'): Promise<void> {
  try {
    unwrap((await apiClient.put(`/users/follow/approve-follow/${id}`, { status })).data);
  } catch (error) {
    throw serviceError(error);
  }
}
export async function followUser(id: string): Promise<void> {
  try {
    unwrap((await apiClient.post('/users/follow/follow-request', { following: id })).data);
  } catch (error) {
    throw serviceError(error);
  }
}
export const realRequestsService: RequestsService = {
  async list() {
    return {
      incoming: (await pendingFollows()).map((f) => ({
        id: f._id,
        user: mapProfile(f.follower),
        direction: 'incoming' as const,
        createdAt: f.createdAt,
        superLike: false,
      })),
      outgoing: [],
    };
  },
  async send() {
    throw new ServiceError('VALIDATION', 'Use Follow on the user profile.');
  },
  async accept(id) {
    const follow = (await pendingFollows()).find((f) => f._id === id);
    if (!follow) throw new ServiceError('NOT_FOUND');
    await approveFollow(id, 'accepted');
    return { conversationId: `user:${follow.follower._id}` };
  },
  decline: (id) => approveFollow(id, 'rejected'),
  async cancel() {
    throw new ServiceError(
      'VALIDATION',
      'Pending outgoing requests are not exposed by this backend.',
    );
  },
};
