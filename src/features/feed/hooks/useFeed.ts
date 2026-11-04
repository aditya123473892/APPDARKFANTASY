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
  listLikers,
  listMyPosts,
  listSavedPosts,
  getPost,
  setCommentLiked,
  setPostSaved,
} from '../services/feedService.real';
import { isPreviewPost } from '../mockSocial';
import type { CommentPage, CreatePostInput, FeedPage, Post, PostComment } from '../types';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { useAuthStore } from '@/features/auth/store/authStore';
import { usePostPresentation } from '../presentation';
import { useCallback } from 'react';

// New posts shift offsets, so a later page can repeat a post already shown. A stable
// function lets the query reuse its result instead of re-running this on every render.
const uniquePosts = (data: InfiniteData<FeedPage>) => {
  const seen = new Set<string>();
  return data.pages.flatMap((page) =>
    page.posts.filter((post) => !seen.has(post.id) && seen.add(post.id)),
  );
};
/** The public feed, loaded page by page. `data` is the flattened, de-duplicated list. */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.feed,
    queryFn: ({ pageParam, signal }) => feedService.listPage(pageParam, signal),
    initialPageParam: 'start',
    getNextPageParam: (last: FeedPage) => last.nextCursor,
    select: uniquePosts,
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

/** Shows a post the viewer just created, at the top of the feed, then refreshes. */
export function insertCreatedPost(client: QueryClient, post: Post): void {
  if (post.status === 'approved' && post.audience === 'everyone')
    client.setQueryData<InfiniteData<FeedPage>>(queryKeys.feed, (data) =>
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
  void client.invalidateQueries({ queryKey: queryKeys.myPosts });
  void client.invalidateQueries({ queryKey: queryKeys.feed });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['feed', 'create'],
    mutationFn: (input: CreatePostInput) => feedService.create(input),
    onMutate: () => sessionIdentity.userId,
    onSuccess: (post, _input, identity) => {
      if (!identity || identity !== sessionIdentity.userId) return;
      insertCreatedPost(queryClient, post);
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
      // The comment count is already patched in every list; refetching the whole feed
      // here only showed a spinner and re-rendered every card. Refresh them next time.
      for (const queryKey of [queryKeys.feed, queryKeys.myPosts, ['user-posts']])
        void client.invalidateQueries({ queryKey, refetchType: 'none' });
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

/** People who liked a post, loaded page by page while the sheet is open. */
export function useLikers(postId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['posts', postId, 'likes'],
    queryFn: ({ pageParam }) => listLikers(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: { nextCursor?: string }) => last.nextCursor,
    enabled: enabled && Boolean(postId),
  });
}

function updateComment(
  client: QueryClient,
  postId: string,
  commentId: string,
  update: (comment: PostComment) => PostComment,
) {
  client.setQueryData<InfiniteData<CommentPage>>(queryKeys.comments(postId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            comments: page.comments.map((comment) =>
              comment.id === commentId ? update(comment) : comment,
            ),
          })),
        }
      : data,
  );
}

/** The newest tap per comment or post; only that one may roll back or settle the UI. */
const commentLikeIntent = new Map<string, boolean>();
const savedIntent = new Map<string, boolean>();

/** A heart on a comment: shown at once, settled by the server's count, undone on failure. */
export function useToggleCommentLike(postId: string) {
  const client = useQueryClient();
  const show = useCallback(
    (commentId: string, liked: boolean, count?: number) =>
      updateComment(client, postId, commentId, (comment) => {
        const current = comment.likeCount ?? 0;
        return {
          ...comment,
          likedByMe: liked,
          likeCount:
            count ??
            (Boolean(comment.likedByMe) === liked
              ? current
              : Math.max(0, current + (liked ? 1 : -1))),
        };
      }),
    [client, postId],
  );
  const { mutate } = useMutation({
    scope: { id: `comment-like:${postId}` },
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) =>
      setCommentLiked(postId, commentId, liked),
    onSuccess: (state, { commentId, liked }) => {
      if (commentLikeIntent.get(commentId) !== liked) return;
      commentLikeIntent.delete(commentId);
      show(commentId, state.liked, state.likeCount);
    },
    onError: (error, { commentId, liked }) => {
      if (commentLikeIntent.get(commentId) === liked) {
        commentLikeIntent.delete(commentId);
        show(commentId, !liked);
      }
      toast.error(describeError(error, "Couldn't update that like."));
    },
  });
  return useCallback(
    (comment: PostComment) => {
      if (comment.pending) return;
      const liked = !(commentLikeIntent.get(comment.id) ?? comment.likedByMe ?? false);
      commentLikeIntent.set(comment.id, liked);
      show(comment.id, liked);
      mutate({ commentId: comment.id, liked });
    },
    [mutate, show],
  );
}

function showSaved(post: Post, saved: boolean) {
  usePostPresentation.setState(({ saved: current }) => {
    const next = { ...current };
    if (saved) next[post.id] = current[post.id] ?? post;
    else delete next[post.id];
    return { saved: next };
  });
}

/** Save or unsave a post on the server; shown at once and undone if it fails. */
export function useToggleSaved() {
  const { mutate } = useMutation({
    scope: { id: 'post-saved' },
    mutationFn: ({ post, saved }: { post: Post; saved: boolean }) => setPostSaved(post.id, saved),
    onSuccess: (_data, { post, saved }) => {
      if (savedIntent.get(post.id) === saved) savedIntent.delete(post.id);
    },
    onError: (error, { post, saved }) => {
      if (savedIntent.get(post.id) === saved) {
        savedIntent.delete(post.id);
        showSaved(post, !saved);
      }
      toast.error(describeError(error, saved ? "Couldn't save that post." : "Couldn't remove that post."));
    },
  });
  return useCallback(
    (post: Post) => {
      // Built-in preview posts exist only on this device.
      if (isPreviewPost(post)) return usePostPresentation.getState().toggleSaved(post);
      const saved = !(savedIntent.get(post.id) ?? Boolean(usePostPresentation.getState().saved[post.id]));
      savedIntent.set(post.id, saved);
      showSaved(post, saved);
      mutate({ post, saved });
    },
    [mutate],
  );
}

/**
 * Loads the viewer's saved posts from the server once per session (and again after an
 * entitlement change resets it). They used to live in memory only and vanished on restart.
 */
export function useSavedPostsSync() {
  const signedIn = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const scope = sessionIdentity.generation;
      const posts = await listSavedPosts();
      if (scope !== sessionIdentity.generation) return posts.length;
      usePostPresentation.setState(({ saved }) => {
        const next: Record<string, Post> = {};
        for (const post of posts) next[post.id] = post;
        // A save or unsave still on its way wins over a list fetched before it landed.
        for (const [id, wanted] of savedIntent) {
          if (!wanted) delete next[id];
          else if (saved[id]) next[id] = saved[id];
        }
        for (const post of Object.values(saved)) if (isPreviewPost(post)) next[post.id] = post;
        return { saved: next };
      });
      return posts.length;
    },
    staleTime: 5 * 60_000,
    enabled: signedIn,
  });
}
