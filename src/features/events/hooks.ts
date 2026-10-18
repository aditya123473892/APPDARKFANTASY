import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { sessionIdentity, isSessionCurrent } from '@/features/auth/sessionRuntime';
import { eventsService } from './service';

export function useEvents() {
  const userId = useCurrentUserId();
  const query = useQuery({
    queryKey: ['events', userId, 'list'],
    queryFn: eventsService.list,
    enabled: Boolean(userId),
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return query;
}

export function useEvent(id: string) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: ['events', userId, id],
    queryFn: () => eventsService.get(id),
    enabled: Boolean(userId && id),
  });
}

export function useEventAction<T>(action: (input: T) => Promise<unknown>, message: string) {
  const client = useQueryClient();
  const lock = useRef(false);
  return useMutation({
    mutationFn: async (input: T) => {
      if (lock.current) throw new Error('Action already in progress');
      lock.current = true;
      const scope = sessionIdentity.generation;
      try {
        await action(input);
        return scope;
      } finally {
        lock.current = false;
      }
    },
    onSuccess: async (scope) => {
      if (!isSessionCurrent(scope)) return;
      toast.success(message);
      await client.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error) =>
      toast.error(
        describeError(
          error,
          'Could not complete this action. Refresh to check its status before trying again.',
        ),
      ),
  });
}
