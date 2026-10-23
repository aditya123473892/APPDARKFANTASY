import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { sessionIdentity, isSessionCurrent } from '@/features/auth/sessionRuntime';
import { useOutbox } from '@/features/chat/store/outboxStore';
import { changeBlock } from './blocks';
import { setPeerBlocked, useBlockState } from './blockState';
import { invalidateSafety, purgePeer, redactCached } from './blockCache';

export function useBlock() {
  const mutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => changeBlock(id, blocked),
    networkMode: 'always',
    retry: false,
    onMutate: async ({ id, blocked }) => {
      const scope = sessionIdentity.generation;
      const previous = useBlockState.getState().ids.includes(id);
      useBlockState.setState((state) => ({ pending: [...state.pending, id] }));
      setPeerBlocked(id, blocked);
      const cached = blocked ? await purgePeer(id) : undefined;
      return { previous, cached, scope };
    },
    onError: (error, { id }, context) => {
      if (!context || !isSessionCurrent(context.scope)) return;
      setPeerBlocked(id, context.previous);
      context.cached?.snapshots.forEach((item) => {
        const restored = useBlockState
          .getState()
          .ids.reduce((data, peer) => redactCached(data, peer), item.data);
        if (restored !== undefined) queryClient.setQueryData(item.key, restored);
      });
      context.cached?.pending.forEach((item) =>
        useOutbox.getState().upsert({ ...item, status: 'uncertain' }),
      );
      toast.error(describeError(error, 'Unable to update block. Please try again.'));
    },
    onSuccess: (_data, { blocked }, context) => {
      if (context && isSessionCurrent(context.scope))
        toast.success(blocked ? 'User blocked' : 'User unblocked');
    },
    onSettled: (_data, _error, { id }, context) => {
      if (!context || !isSessionCurrent(context.scope)) return;
      useBlockState.setState((state) => ({ pending: state.pending.filter((peer) => peer !== id) }));
      void queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      void invalidateSafety();
    },
  });
  const confirm = (id: string) => {
    if (mutation.isPending || useBlockState.getState().pending.includes(id)) return;
    Alert.alert(
      'Block this user?',
      'You will disappear from each other’s profiles, feed and direct chats. Pending requests are cancelled. Shared groups remain, but neither of you will see the other’s messages there. You can unblock in Settings. Previously opened image links may work briefly until they expire.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            if (!useBlockState.getState().pending.includes(id))
              mutation.mutate({ id, blocked: true });
          },
        },
      ],
    );
  };
  return { ...mutation, confirm };
}
