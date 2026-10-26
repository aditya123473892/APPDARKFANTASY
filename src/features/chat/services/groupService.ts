import axios from 'axios';
import { uploadPhoto } from '@/services/api/photoUpload';
import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap, serviceError } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import type { UploadAsset } from '@/features/feed/types';
import type { BackendGroup } from './chatService.real';

/** Limits enforced by the backend; the UI validates them before submitting. */
export const GROUP_NAME_MAX = 100;
export const GROUP_DESCRIPTION_MAX = 500;
export const GROUP_MEMBERS_MAX = 256;

async function call<T>(request: () => Promise<{ data: unknown }>): Promise<T> {
  try {
    return unwrap<T>((await request()).data as never);
  } catch (error) {
    throw serviceError(error);
  }
}

export type CreateGroupInput = {
  name: string;
  description?: string;
  members: string[];
  /** Idempotency key: a retried create with the same key returns the first group. */
  clientId?: string;
};

/**
 * Maps a create-group failure to fixed, user-facing copy. Server text is only
 * matched, never shown.
 */
export function createGroupError(error: unknown): ServiceError {
  if (!axios.isAxiosError(error)) return serviceError(error) as ServiceError;
  const status = error.response?.status;
  const body = error.response?.data as { message?: unknown; errors?: Record<string, unknown> };
  const text = [body?.message].flat().join(' ');
  if (!error.response) return new ServiceError('NETWORK');
  if (status === 400) {
    if (body?.errors?.name || /group name/i.test(text))
      return new ServiceError(
        'VALIDATION',
        `Give the group a name of up to ${GROUP_NAME_MAX} characters.`,
      );
    if (body?.errors?.description || /description/i.test(text))
      return new ServiceError(
        'VALIDATION',
        `Keep the description under ${GROUP_DESCRIPTION_MAX} characters.`,
      );
    if (/can no longer be added|unavailable/i.test(text))
      return new ServiceError(
        'VALIDATION',
        "Some people you picked can't be added anymore. Remove them and try again.",
      );
    if (body?.errors?.members || /member/i.test(text))
      return new ServiceError('VALIDATION', 'Choose at least one person to add.');
    return new ServiceError('VALIDATION', 'Check the group details and try again.');
  }
  if (status === 401)
    return new ServiceError('VALIDATION', 'Your session has ended. Sign in again to continue.');
  if (status === 403)
    return new ServiceError('VALIDATION', "Your account can't create groups right now.");
  if (status === 409)
    return new ServiceError('CONFLICT', 'This group was already created. Check your chats.');
  if (status === 429)
    return new ServiceError('VALIDATION', 'Too many attempts. Wait a moment and try again.');
  return new ServiceError('UNKNOWN', "We couldn't create the group. Please try again.");
}

export const groupService = {
  get: (id: string) => getData<BackendGroup>(`/groups/${id}/members`),
  async create(input: CreateGroupInput) {
    const description = input.description?.trim();
    try {
      const response = await apiClient.post('/groups/create-group', {
        name: input.name.trim(),
        members: [...new Set(input.members)],
        ...(description ? { description } : {}),
        ...(input.clientId ? { clientId: input.clientId } : {}),
      });
      return unwrap<BackendGroup>(response.data);
    } catch (error) {
      throw error instanceof ServiceError ? error : createGroupError(error);
    }
  },
  update(id: string, changes: { name?: string; description?: string }) {
    return call<BackendGroup>(() =>
      apiClient.put(`/groups/${id}`, {
        ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
        ...(changes.description !== undefined ? { description: changes.description.trim() } : {}),
      }),
    );
  },
  async uploadIcon(id: string, asset: UploadAsset) {
    const uploadId = await uploadPhoto(asset);
    return call<BackendGroup>(() => apiClient.put(`/groups/${id}/upload-icon`, { uploadId }));
  },
  add(id: string, members: string[]) {
    return call<BackendGroup>(() =>
      apiClient.post('/groups/add-members', { groupId: id, members }),
    );
  },
  remove(id: string, member: string) {
    return call<BackendGroup>(() =>
      apiClient.post('/groups/remove-members', { groupId: id, members: [member] }),
    );
  },
  leave(id: string) {
    return call<{ groupId: string; deleted: boolean }>(() => apiClient.post(`/groups/${id}/leave`));
  },
  delete(id: string) {
    return call<{ groupId: string; deleted: boolean }>(() => apiClient.delete(`/groups/${id}`));
  },
};
