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
export async function pendingFollows(signal?: AbortSignal) {
  const { followRequests } = await getData<{ followRequests: Follow[] }>(
    '/users/follow/follow-requests', undefined, signal,
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
export async function followUser(id: string): Promise<{ _id: string; status: string }> {
  try {
    return unwrap<{ follow: { _id: string; status: string } }>((await apiClient.post('/users/follow/follow-request', { following: id })).data).follow;
  } catch (error) {
    throw serviceError(error);
  }
}
export async function unfollowUser(id: string): Promise<void> {
  try { unwrap((await apiClient.delete('/users/follow/unfollow/' + id)).data); }
  catch (error) { throw serviceError(error); }
}
export const realRequestsService: RequestsService = {
  async list(signal) {
    const [incoming, outgoing] = await Promise.all([pendingFollows(signal),
      getData<{ followRequests: Follow[] }>('/users/follow/outgoing', undefined, signal)]);
    return {
      incoming: incoming.map((f) => ({
        id: f._id,
        user: mapProfile(f.follower),
        direction: 'incoming' as const,
        createdAt: f.createdAt,
        superLike: false,
      })),
      outgoing: outgoing.followRequests.map(f => ({ id: f._id,
        user: mapProfile(f.following as User), direction: 'outgoing' as const,
        createdAt: f.createdAt, superLike: false })),
    };
  },
  async send() {
    throw new ServiceError('VALIDATION', 'Use Follow on the user profile.');
  },
  async accept(id, requesterId) {
    const peer = requesterId ?? (await pendingFollows()).find((f) => f._id === id)?.follower._id;
    if (!peer) throw new ServiceError('NOT_FOUND');
    await approveFollow(id, 'accepted');
    return { conversationId: `user:${peer}` };
  },
  decline: (id) => approveFollow(id, 'rejected'),
  async cancel(id) {
    try { unwrap((await apiClient.delete('/users/follow/cancel/' + id)).data); }
    catch (error) { throw serviceError(error); }
  },
};
