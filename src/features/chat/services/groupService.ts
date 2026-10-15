import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap, serviceError } from '@/services/api/backend';
import type { BackendGroup } from './chatService.real';
export const groupService = {
  get: (id: string) => getData<BackendGroup>(`/groups/${id}/members`),
  async create(name: string, members: string[]) {
    try {
      return unwrap<BackendGroup>(
        (
          await apiClient.post('/groups/create-group', {
            name: name.trim(),
            members: [...new Set(members)],
          })
        ).data,
      );
    } catch (error) {
      throw serviceError(error);
    }
  },
  async add(id: string, members: string[]) {
    try {
      return unwrap<BackendGroup>(
        (await apiClient.post('/groups/add-members', { groupId: id, members })).data,
      );
    } catch (error) {
      throw serviceError(error);
    }
  },
  async remove(id: string, member: string) {
    try {
      return unwrap<BackendGroup>(
        (await apiClient.post('/groups/remove-members', { groupId: id, members: [member] })).data,
      );
    } catch (error) {
      throw serviceError(error);
    }
  },
};
