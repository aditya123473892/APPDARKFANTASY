import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { feedService } from '../services';
import type { CreatePostInput, Post } from '../types';

export function useFeed() {
  return useQuery({ queryKey: queryKeys.feed, queryFn: () => feedService.list() });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['feed', 'create'],
    mutationFn: (input: CreatePostInput) => feedService.create(input),
    onSuccess: (post) => {
      queryClient.setQueryData<Post[]>(queryKeys.feed, (current) =>
        current ? [post, ...current] : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed });
    },
  });
}

/** Optimistic like toggle that rolls back and tells the user if the server rejects it. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const patch = (postId: string, liked: boolean) =>
    queryClient.setQueryData<Post[]>(queryKeys.feed, (current) =>
      current?.map((post) =>
        post.id === postId && post.liked !== liked
          ? { ...post, liked, likes: post.likes + (liked ? 1 : -1) }
          : post,
      ),
    );
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      feedService.setLiked(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feed });
      patch(postId, liked);
    },
    onError: (error, { postId, liked }) => {
      patch(postId, !liked);
      toast.error(describeError(error, "Couldn't update that like."));
    },
  });
}
