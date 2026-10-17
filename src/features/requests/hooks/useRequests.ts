import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { requestsService } from '../services';
import { followUser } from '../services/requestsService.real';
import type { ConnectionRequest, RequestsResult } from '../types';

/**
 * Follow request ("interest") from a profile or discovery row. The backend exposes no
 * outgoing-request state, so this session's successful request is the only "Requested"
 * signal. State is read from the mutation cache by user id, so it is shared between screens
 * and never leaks between recycled list rows.
 */
export function useFollowUser(userId: string) {
  const mutationKey = ['requests', 'follow', userId];
  const mutation = useMutation({
    mutationKey,
    mutationFn: () => followUser(userId),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Follow request sent');
    },
    onError: (error) =>
      toast.error(describeError(error, 'Unable to follow this user. A request may already exist.')),
  });
  const statuses = useMutationState({
    filters: { mutationKey, exact: true },
    select: (item) => item.state.status,
  });
  return {
    follow: () => mutation.mutate(),
    requested: statuses.includes('success'),
    pending: statuses.includes('pending'),
  };
}

export function useRequests() {
  return useQuery({ queryKey: queryKeys.requests, queryFn: () => requestsService.list() });
}

export function useIncomingRequestCount(): number {
  return useRequests().data?.incoming.length ?? 0;
}

/** Everything a request changes on the server: lists, profiles' relationship, chats, notifications. */
function useInvalidateSocial() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
      queryClient.invalidateQueries({ queryKey: ['profiles'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    ]);
}

function removeFromCache(
  current: RequestsResult | undefined,
  requestId: string,
): RequestsResult | undefined {
  if (!current) return current;
  return {
    incoming: current.incoming.filter((item) => item.id !== requestId),
    outgoing: current.outgoing.filter((item) => item.id !== requestId),
  };
}

/**
 * Accept / decline / cancel. Each mutation is keyed by request id so the UI can disable
 * exactly the row being processed, and the server state is re-synced after every action.
 */
export function useRequestActions() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateSocial();
  const router = useRouter();

  const optimisticRemove = async (request: ConnectionRequest) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.requests });
    const previous = queryClient.getQueryData<RequestsResult>(queryKeys.requests);
    queryClient.setQueryData(queryKeys.requests, removeFromCache(previous, request.id));
    return { previous };
  };
  const rollback = (
    _error: unknown,
    _request: ConnectionRequest,
    context?: { previous?: RequestsResult },
  ) => {
    if (context?.previous) queryClient.setQueryData(queryKeys.requests, context.previous);
  };

  const accept = useMutation({
    mutationKey: ['requests', 'accept'],
    mutationFn: (request: ConnectionRequest) => requestsService.accept(request.id),
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      rollback(error, request, context);
      toast.error(describeError(error, `Couldn't accept ${request.user.name}'s request.`));
    },
    onSuccess: ({ conversationId }, request) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(`You and ${request.user.name} are connected`, {
        label: 'Message',
        onPress: () => router.push(`/chat/${conversationId}`),
      });
    },
    onSettled: invalidate,
  });

  const decline = useMutation({
    mutationKey: ['requests', 'decline'],
    mutationFn: (request: ConnectionRequest) => requestsService.decline(request.id),
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      rollback(error, request, context);
      toast.error(describeError(error, "Couldn't decline that request."));
    },
    onSuccess: (_data, request) => toast.show(`Declined ${request.user.name}'s request`),
    onSettled: invalidate,
  });

  const cancel = useMutation({
    mutationKey: ['requests', 'cancel'],
    mutationFn: (request: ConnectionRequest) => requestsService.cancel(request.id),
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      rollback(error, request, context);
      toast.error(describeError(error, "Couldn't cancel that request."));
    },
    onSuccess: (_data, request) => toast.show(`Request to ${request.user.name} cancelled`),
    onSettled: invalidate,
  });

  const pendingId = [accept, decline, cancel].find((mutation) => mutation.isPending)?.variables?.id;
  return { accept, decline, cancel, pendingId };
}

/** Sending a request (a "like"). If they already requested you, you connect straight away. */
export function useSendRequest() {
  const invalidate = useInvalidateSocial();
  const router = useRouter();
  return useMutation({
    mutationKey: ['requests', 'send'],
    mutationFn: ({ userId, superLike }: { userId: string; name: string; superLike?: boolean }) =>
      requestsService.send(userId, { superLike }),
    onSuccess: (result, { name, superLike }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.status === 'connected') {
        toast.success(`It's mutual — you and ${name} are connected`, {
          label: 'Message',
          onPress: () => router.push(`/chat/${result.conversationId}`),
        });
      } else {
        toast.success(superLike ? `Super like sent to ${name}` : `Request sent to ${name}`);
      }
    },
    onError: (error, { name }) =>
      toast.error(describeError(error, `Couldn't send a request to ${name}.`)),
    onSettled: invalidate,
  });
}
