import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap, serviceError } from '@/services/api/backend';
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

export const groupService = {
  get: (id: string) => getData<BackendGroup>(`/groups/${id}/members`),
  create(input: CreateGroupInput) {
    const description = input.description?.trim();
    return call<BackendGroup>(() =>
      apiClient.post('/groups/create-group', {
        name: input.name.trim(),
        members: [...new Set(input.members)],
        ...(description ? { description } : {}),
        ...(input.clientId ? { clientId: input.clientId } : {}),
      }),
    );
  },
  update(id: string, changes: { name?: string; description?: string }) {
    return call<BackendGroup>(() =>
      apiClient.put(`/groups/${id}`, {
        ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
        ...(changes.description !== undefined ? { description: changes.description.trim() } : {}),
      }),
    );
  },
  uploadIcon(id: string, asset: UploadAsset) {
    const form = new FormData();
    if (asset.file) form.append('groupIcon', asset.file, asset.name);
    else
      form.append('groupIcon', {
        uri: asset.uri,
        name: asset.name,
        type: asset.type,
      } as unknown as Blob);
    return call<BackendGroup>(() =>
      apiClient.put(`/groups/${id}/upload-icon`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }),
    );
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
