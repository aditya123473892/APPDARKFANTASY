import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, serviceError, unwrap } from '@/services/api/backend';
import { uploadPhoto } from '@/services/api/photoUpload';
import { sessionIdentity, assertSessionCurrent } from '@/features/auth/sessionRuntime';
import type { UploadAsset } from '@/features/feed/types';
import type { Event, EventInput, EventMember } from './types';

async function call<T>(request: () => Promise<{ data: unknown }>): Promise<T> {
  try {
    return unwrap<T>((await request()).data as never);
  } catch (error) {
    throw serviceError(error);
  }
}

export const eventsService = {
  list: () => getCollection<Event>('/events', 'events'),
  get: (id: string) => getData<Event>(`/events/${id}`),
  participants: (id: string) =>
    getData<{ participants: EventMember[] }>(`/event-members/${id}/participants`).then(
      (data) => data.participants,
    ),
  requests: (id: string) =>
    getData<{ pendingRequests: EventMember[] }>(`/event-members/${id}/requests/pending`).then(
      (data) => data.pendingRequests,
    ),
  join: (id: string, user: string) =>
    call<EventMember>(() => apiClient.post('/event-members/join', { event: id, user })),
  decide: (id: string, requestStatus: 'accepted' | 'rejected') =>
    call<EventMember>(() => apiClient.put(`/event-members/${id}/status`, { requestStatus })),
  // This endpoint returns a plain message rather than the standard envelope.
  async removeMember(id: string) {
    try {
      const response = await apiClient.delete(`/event-members/${id}`);
      if (response.data?.error || response.data?.statusCode >= 400) unwrap(response.data);
    } catch (error) {
      throw serviceError(error);
    }
  },
  delete: (id: string) => call<{ deleted: boolean }>(() => apiClient.delete(`/events/${id}`)),
  async save(input: EventInput, id?: string, cover?: UploadAsset) {
    const scope = sessionIdentity.generation;
    const coverUploadId = cover ? await uploadPhoto(cover) : undefined;
    assertSessionCurrent(scope);
    const payload = { ...input, ...(coverUploadId ? { coverUploadId } : {}) };
    return call<Event>(() =>
      id ? apiClient.put(`/events/${id}`, payload) : apiClient.post('/events', payload),
    );
  },
};
