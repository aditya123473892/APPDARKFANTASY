import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { activityService } from '../services';
import type { NotificationPage } from '../types';
import { sessionIdentity } from '@/features/auth/sessionRuntime';

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => activityService.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    select: (data) => {
      const seen = new Set<string>();
      return {
        items: data.pages.flatMap((page) =>
          page.items.filter((item) => !seen.has(item.id) && seen.add(item.id)),
        ),
        unreadCount: data.pages[0]?.unreadCount ?? 0,
      };
    },
  });
}

export function useUnreadNotificationCount(): number {
  return useNotifications().data?.unreadCount ?? 0;
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => activityService.markRead(ids),
    onMutate: async (ids) => {
      const generation = sessionIdentity.generation;
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      if (generation !== sessionIdentity.generation) return generation;
      queryClient.setQueryData<InfiniteData<NotificationPage>>(
        queryKeys.notifications,
        (current) => {
          if (!current) return current;
          const marked = new Set(
            current.pages.flatMap((page) =>
              page.items
                .filter((item) => !item.read && (!ids || ids.includes(item.id)))
                .map((item) => item.id),
            ),
          );
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              unreadCount: ids ? Math.max(0, page.unreadCount - marked.size) : 0,
              items: page.items.map((item) =>
                !ids || ids.includes(item.id) ? { ...item, read: true } : item,
              ),
            })),
          };
        },
      );
      return generation;
    },
    onSettled: (_data, _error, _ids, generation) => {
      if (generation === sessionIdentity.generation)
        return queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
