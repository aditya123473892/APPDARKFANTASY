import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { requestsService } from '../services';
import { followUser, unfollowUser } from '../services/requestsService.real';
import { getData } from '@/services/api/backend';
import { relationshipKey, relationshipChanging as changing, type FollowRelationship } from '../relationship';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import type { ConnectionRequest, RequestsResult } from '../types';
import { restoreRequest } from '../requestCache';

const pendingRequestActions = new Set<string>();
type RequestContext = { previous?: RequestsResult; generation: number; reservation: string };

export function useFollowUser(userId: string) {
  const client = useQueryClient();
  const invalidate = useInvalidateSocial();
  const key = relationshipKey(userId);
  const generation = sessionIdentity.generation;
  const reservation = `${generation}:${userId}`;
  const query = useQuery({ queryKey: key, enabled: Boolean(userId),
    queryFn: async ({ signal }) => (await getData<{ relationship: FollowRelationship }>(
      '/users/follow/relationship/' + userId, undefined, signal)).relationship });
  const state = query.data ?? { status: 'none' as const };
  const mutationKey = ['requests', 'follow', userId];
  const mutation = useMutation({ mutationKey,
    mutationFn: async (remove: boolean) => {
      if (reservation !== `${sessionIdentity.generation}:${userId}`) throw new Error('Session changed');
      if (remove) { await unfollowUser(userId); return { status: 'none' } as FollowRelationship; }
      const edge = await followUser(userId);
      return { status: edge.status === 'accepted' ? 'following' : 'requested', requestId: edge._id } as FollowRelationship;
    },
    onMutate: async (remove) => {
      if (generation !== sessionIdentity.generation) throw new Error('Session changed');
      await client.cancelQueries({ queryKey: key });
      if (generation !== sessionIdentity.generation) return { generation };
      const previous = client.getQueryData<FollowRelationship>(key);
      client.setQueryData(key, { status: remove ? 'none' : 'requested' });
      return { previous, generation };
    },
    onSuccess: (data, _remove, context) => {
      if (context?.generation === sessionIdentity.generation) client.setQueryData(key, data);
    },
    onError: (error, _remove, context) => {
      if (context?.generation !== sessionIdentity.generation) return;
      client.setQueryData(key, context?.previous ?? { status: 'none' });
      toast.error(describeError(error, 'Could not update follow status. Try again.'));
    },
    onSettled: async (_data, _error, _remove, context) => {
      try {
        if (context?.generation !== sessionIdentity.generation) return;
        await client.invalidateQueries({ queryKey: key });
        await invalidate();
      } finally { changing.delete(reservation); }
    },
  });
  const statuses = useMutationState({ filters: { mutationKey, exact: true }, select: item => item.state.status });
  return { state, requested: state.status === 'requested', loading: query.isPending,
    error: query.isError && !query.data, retry: () => void query.refetch(),
    pending: statuses.includes('pending'),
    follow: () => { if (!changing.has(reservation)) { changing.add(reservation); mutation.mutate(false); } },
    remove: () => { if (!changing.has(reservation)) { changing.add(reservation); mutation.mutate(true); } },
  };
}

export function useRequests() {
  return useQuery({ queryKey: queryKeys.requests, queryFn: ({ signal }) => requestsService.list(signal) });
}

export function useIncomingRequestCount(): number {
  return useRequests().data?.incoming.length ?? 0;
}

/** Everything a request changes on the server: lists, profiles' relationship, chats, notifications. */
function useInvalidateSocial() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      // What the action visibly changes refreshes now.
      queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
      queryClient.invalidateQueries({ queryKey: ['social-lists'] }),
      queryClient.invalidateQueries({ queryKey: ['social-counts'] }),
      queryClient.invalidateQueries({ queryKey: ['relationships'] }),
      // The rest refreshes when next shown. Refetching all of it on one Follow tap
      // reloaded every Discover page, the feed and the chats at once.
      ...[queryKeys.feed, ['user-posts'], ['profiles'], queryKeys.conversations, queryKeys.notifications].map(
        (queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'none' }),
      ),
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
  const generation = sessionIdentity.generation;
  const current = (context?: RequestContext) => context?.generation === sessionIdentity.generation;

  const optimisticRemove = async (request: ConnectionRequest) => {
    const reservation = `${generation}:${request.id}`;
    if (generation !== sessionIdentity.generation || pendingRequestActions.has(reservation))
      throw new Error('Request action is unavailable');
    pendingRequestActions.add(reservation);
    try {
      await queryClient.cancelQueries({ queryKey: queryKeys.requests });
      if (generation !== sessionIdentity.generation) throw new Error('Session changed');
      const previous = queryClient.getQueryData<RequestsResult>(queryKeys.requests);
      queryClient.setQueryData(queryKeys.requests, removeFromCache(previous, request.id));
      return { previous, generation, reservation };
    } catch (error) { pendingRequestActions.delete(reservation); throw error; }
  };
  const rollback = (
    _error: unknown,
    request: ConnectionRequest,
    context?: RequestContext,
  ) => {
    if (current(context)) queryClient.setQueryData<RequestsResult>(queryKeys.requests,
      data => restoreRequest(data, context?.previous, request.id));
  };
  const settled = async (_data: unknown, _error: unknown, _request: ConnectionRequest, context?: RequestContext) => {
    try { if (current(context)) await invalidate(); }
    finally { if (context) pendingRequestActions.delete(context.reservation); }
  };
  const assertActionSession = () => {
    if (generation !== sessionIdentity.generation) throw new Error('Session changed');
  };

  const accept = useMutation({
    mutationKey: ['requests', 'accept'],
    mutationFn: (request: ConnectionRequest) => { assertActionSession(); return requestsService.accept(request.id, request.user.id); },
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      if (!current(context)) return;
      rollback(error, request, context);
      toast.error(describeError(error, `Couldn't accept ${request.user.name}'s request.`));
    },
    onSuccess: ({ conversationId }, request, context) => {
      if (!current(context)) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      toast.success(`You and ${request.user.name} are connected`, {
        label: 'Message',
        onPress: () => { if (current(context)) router.push(`/chat/${conversationId}`); },
      });
    },
    onSettled: settled,
  });

  const decline = useMutation({
    mutationKey: ['requests', 'decline'],
    mutationFn: (request: ConnectionRequest) => { assertActionSession(); return requestsService.decline(request.id); },
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      if (!current(context)) return;
      rollback(error, request, context);
      toast.error(describeError(error, "Couldn't decline that request."));
    },
    onSuccess: (_data, request, context) => { if (current(context)) toast.show(`Declined ${request.user.name}'s request`); },
    onSettled: settled,
  });

  const cancel = useMutation({
    mutationKey: ['requests', 'cancel'],
    mutationFn: (request: ConnectionRequest) => { assertActionSession(); return requestsService.cancel(request.id); },
    onMutate: optimisticRemove,
    onError: (error, request, context) => {
      if (!current(context)) return;
      rollback(error, request, context);
      toast.error(describeError(error, "Couldn't cancel that request."));
    },
    onSuccess: (_data, request, context) => { if (current(context)) toast.show(`Request to ${request.user.name} cancelled`); },
    onSettled: settled,
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
