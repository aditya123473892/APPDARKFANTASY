import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { activityService } from '../services';
import type { AppNotification } from '../types';

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => activityService.list() });
}

export function useUnreadNotificationCount(): number {
  return useNotifications().data?.filter((item) => !item.read).length ?? 0;
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => activityService.markRead(ids),
    onMutate: (ids) =>
      queryClient.setQueryData<AppNotification[]>(queryKeys.notifications, (current) =>
        current?.map((item) => (!ids || ids.includes(item.id) ? { ...item, read: true } : item)),
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
