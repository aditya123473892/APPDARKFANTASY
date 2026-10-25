import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { feedService } from '../services';
import {
  addComment,
  deleteComment,
  deletePost,
  listComments,
  listMyPosts,
  getPost,
} from '../services/feedService.real';
import type { CommentPage, CreatePostInput, FeedPage, Post, PostComment } from '../types';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePostPresentation } from '../presentation';

/** The public feed, loaded page by page. `data` is the flattened, de-duplicated list. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.feed,
    queryFn: ({ pageParam }) => feedService.listPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last: FeedPage, pages: FeedPage[]) => {
      const loaded = pages.reduce((total, page) => total + page.posts.length, 0);
      return last.posts.length && loaded < last.count ? loaded : undefined;
    },
    // New posts shift offsets, so a later page can repeat a post already shown.
    select: (data) => {
      const seen = new Set<string>();
      return data.pages.flatMap((page) =>
        page.posts.filter((post) => !seen.has(post.id) && seen.add(post.id)),
      );
    },
  });
}
export function useMyPosts() {
  return useQuery({ queryKey: queryKeys.myPosts, queryFn: listMyPosts });
}

export function useRefreshPost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: getPost,
    onSuccess: (fresh) => updateCachedPost(client, fresh.id, () => fresh),
    onError: (error) => toast.error(describeError(error, "Couldn't refresh this post.")),
  });
}

/**
 * Applies a change to one post in every cached list that shows it (feed,
 * own profile, other profiles). Returning null removes the post.
 */
export function updateCachedPost(
  client: QueryClient,
  postId: string,
  update: (post: Post) => Post | null,
): void {
  const saved = usePostPresentation.getState().saved;
  if (saved[postId]) {
    const next = { ...saved };
    const updated = update(saved[postId]);
    if (updated) next[postId] = updated;
    else delete next[postId];
    usePostPresentation.setState({ saved: next });
  }
  const apply = (posts: Post[]) =>
    posts.flatMap((post) => (post.id === postId ? (update(post) ?? []) : [post]));
  client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: queryKeys.feed }, (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, posts: apply(page.posts) })) }
      : data,
  );
  client.setQueriesData<Post>({ queryKey: ['posts'] }, (post) =>
    post?.id === postId ? (update(post) ?? undefined) : post,
  );
  for (const queryKey of [queryKeys.myPosts, ['user-posts']])
    client.setQueriesData<Post[]>({ queryKey }, (posts) => (posts ? apply(posts) : posts));
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['feed', 'create'],
    mutationFn: (input: CreatePostInput) => feedService.create(input),
    onMutate: () => sessionIdentity.userId,
    onSuccess: (post, _input, identity) => {
      if (!identity || identity !== sessionIdentity.userId) return;
      if (post.status === 'approved' && post.audience === 'everyone')
        queryClient.setQueryData<InfiniteData<FeedPage>>(queryKeys.feed, (data) =>
          data?.pages.length
            ? {
                ...data,
                pages: [
                  { ...data.pages[0]!, posts: [post, ...data.pages[0]!.posts] },
                  ...data.pages.slice(1),
                ],
              }
            : data,
        );
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPosts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed });
    },
  });
}

/** The most recent like/unlike the user asked for, per post. */
const likeIntent = new Map<string, boolean>();

/**
 * Optimistic like toggle. Requests run one at a time in tap order, so rapid
 * taps cannot reach the server out of order; the server's confirmed state is
 * applied once it matches the user's latest intent, and a failure of the
 * latest intent rolls the UI back.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const show = (postId: string, liked: boolean, count?: number) =>
    updateCachedPost(queryClient, postId, (post) => ({
      ...post,
      liked,
      likes:
        count ?? (post.liked === liked ? post.likes : Math.max(0, post.likes + (liked ? 1 : -1))),
    }));
  return useMutation({
    scope: { id: 'post-like' },
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      feedService.setLiked(postId, liked),
    onMutate: async ({ postId, liked }) => {
      likeIntent.set(postId, liked);
      await Promise.all(
        [queryKeys.feed, queryKeys.myPosts, ['user-posts'], ['posts', postId]].map((queryKey) =>
          queryClient.cancelQueries({ queryKey }),
        ),
      );
      if (likeIntent.get(postId) === liked) show(postId, liked);
    },
    onSuccess: (state, { postId }) => {
      if (state && likeIntent.get(postId) === state.liked)
        show(postId, state.liked, state.likeCount);
    },
    onError: (error, { postId, liked }) => {
      if (likeIntent.get(postId) === liked) {
        likeIntent.set(postId, !liked);
        show(postId, !liked);
      }
      toast.error(describeError(error, "Couldn't update that like."));
    },
  });
}

/** Comments of one post, newest first, loaded page by page when opened. */
export function useComments(postId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: ({ pageParam }) => listComments(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: CommentPage) =>
      last.hasMore ? last.comments[last.comments.length - 1]?.id : undefined,
    enabled,
  });
}

function setComments(
  client: QueryClient,
  postId: string,
  update: (comments: PostComment[]) => PostComment[],
) {
  client.setQueryData<InfiniteData<CommentPage>>(queryKeys.comments(postId), (data) =>
    data?.pages.length
      ? {
          ...data,
          pages: data.pages.map((page, index) =>
            index === 0 ? { ...page, comments: update(page.comments) } : page,
          ),
        }
      : { pages: [{ comments: update([]), hasMore: false, count: 0 }], pageParams: [undefined] },
  );
}

/** Adds a comment immediately and replaces it with the server's copy once stored. */
export function useAddComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ content, clientId }: { content: string; clientId: string }) =>
      addComment(postId, content, clientId),
    onMutate: async ({ content, clientId }) => {
      await client.cancelQueries({ queryKey: queryKeys.comments(postId) });
      const me = useAuthStore.getState().user;
      const pending: PostComment = {
        id: `local-${clientId}`,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        pending: true,
        author: {
          id: me?.id ?? '',
          name: me?.name ?? 'You',
          handle: '',
          avatarUri: me?.avatarUri ?? '',
        },
      };
      setComments(client, postId, (comments) => [pending, ...comments]);
      updateCachedPost(client, postId, (post) => ({ ...post, replies: post.replies + 1 }));
      return pending.id;
    },
    onSuccess: (comment, _variables, pendingId) => {
      setComments(client, postId, (comments) => [
        comment,
        ...comments.filter((item) => item.id !== comment.id && item.id !== pendingId),
      ]);
    },
    onError: (error, _variables, pendingId) => {
      setComments(client, postId, (comments) => comments.filter((item) => item.id !== pendingId));
      updateCachedPost(client, postId, (post) => ({
        ...post,
        replies: Math.max(0, post.replies - 1),
      }));
      toast.error(describeError(error, "Couldn't post your comment."));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      void client.invalidateQueries({ queryKey: queryKeys.feed });
      void client.invalidateQueries({ queryKey: queryKeys.myPosts });
      void client.invalidateQueries({ queryKey: ['user-posts'] });
    },
  });
}

export function useDeleteComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(postId, commentId),
    onSuccess: (count, commentId) => {
      client.setQueryData<InfiniteData<CommentPage>>(queryKeys.comments(postId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                comments: page.comments.filter((comment) => comment.id !== commentId),
              })),
            }
          : data,
      );
      updateCachedPost(client, postId, (post) => ({
        ...post,
        replies: count ?? Math.max(0, post.replies - 1),
      }));
    },
    onError: (error) => toast.error(describeError(error, "Couldn't delete that comment.")),
  });
}

export function useDeletePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: (_result, postId) => {
      updateCachedPost(client, postId, () => null);
      client.removeQueries({ queryKey: queryKeys.comments(postId) });
      toast.success('Post deleted');
    },
    onError: (error) => toast.error(describeError(error, "Couldn't delete that post.")),
  });
}
