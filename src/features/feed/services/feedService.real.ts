import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { uploadPhoto } from '@/services/api/photoUpload';
import { createClientId } from '@/utils/clientId';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { userCache } from '@/features/auth/userCache';
import { displayName, type UserSummary } from '@/features/auth/userModel';
import { ServiceError } from '@/services/errors';
import type { CommentPage, ContentVisibility, Post, PostAuthor, PostComment, PostImageResponse } from '../types';
import type { FeedService } from './feedService';
export type BackendPost = {
  _id: string;
  caption?: string;
  user: string | UserSummary;
  createdAt: string;
  visibility?: string;
  contentVisibility?: ContentVisibility;
  locked?: boolean;
  images?: PostImageResponse[];
  status?: string;
  media?: { url?: string; mimetype?: string }[];
  likes?: (string | { user?: string | UserSummary })[];
  comments?: (string | BackendComment)[];
  likeCount?: number;
  commentCount?: number;
  /** Server-computed like state of the requesting user. */
  likedByMe?: boolean;
};
type BackendComment = {
  _id: string;
  content?: string;
  user?: string | UserSummary;
  createdAt?: string;
};
/** Posts per feed request. */
export const FEED_PAGE = 20;

function author(value: string | UserSummary | undefined, fallback?: UserSummary): PostAuthor {
  const user =
    typeof value === 'object' && value ? value : (fallback ?? userCache.get(String(value ?? '')));
  if (user) userCache.put(user);
  return {
    id: user?._id ?? String(value ?? ''),
    name: user ? displayName(user) : 'Unavailable user',
    handle: user?.displayname ?? '',
    avatarUri: mediaUrl(user?.avatar),
  };
}
export function mapComment(comment: BackendComment): PostComment | null {
  if (!comment?._id || typeof comment.content !== 'string') return null;
  return {
    id: comment._id,
    content: comment.content,
    author: author(comment.user),
    createdAt: comment.createdAt,
  };
}
export function mapPost(raw: BackendPost, fallbackAuthor?: UserSummary): Post {
  if (!raw?._id || !raw.createdAt) throw new ServiceError('UNKNOWN');
  const likes = raw.likes ?? [];
  const serverState = typeof raw.likedByMe === 'boolean';
  const locked = raw.contentVisibility === 'premium' && raw.locked !== false;
  const images = raw.images ?? (raw.contentVisibility === 'premium' ? [] : raw.media ?? []);
  return {
    contentVisibility: raw.contentVisibility ?? 'normal',
    locked,
    id: raw._id,
    body: raw.caption ?? '',
    createdAt: raw.createdAt,
    user: author(raw.user, fallbackAuthor),
    media: images
      .filter((image) => locked || mediaUrl(image.url))
      .map((image, index) => ({
        id: 'id' in image ? image.id : `${raw._id}:${index}`,
        uri: mediaUrl(image.url),
        blurhash: 'blurhash' in image ? image.blurhash : null,
        width: ('width' in image && image.width) || 16,
        height: ('height' in image && image.height) || 12,
        mimetype: 'mimetype' in image ? image.mimetype : 'image/jpeg',
      })),
    likes: raw.likeCount ?? likes.length,
    replies: raw.commentCount ?? raw.comments?.length ?? 0,
    liked: serverState
      ? raw.likedByMe === true
      : likes.some(
          (like) =>
            typeof like === 'object' &&
            (typeof like.user === 'object' ? like.user?._id : like.user) === sessionIdentity.userId,
        ),
    likeStateKnown:
      serverState || likes.every((like) => typeof like === 'object' && Boolean(like.user)),
    comments: (raw.comments ?? []).flatMap((comment) => {
      if (typeof comment === 'string') return [];
      const mapped = mapComment(comment);
      return mapped ? [mapped] : [];
    }),
    audience:
      raw.visibility === 'public'
        ? 'everyone'
        : raw.visibility === 'private'
          ? 'private'
          : 'connections',
    status: raw.status,
  };
}
export async function listMyPosts(): Promise<Post[]> {
  return (await getCollection<BackendPost>('/posts/private/me', 'posts')).map((post) =>
    mapPost(post),
  );
}
export async function listUserPosts(id: string): Promise<Post[]> {
  // The server decides visibility for the authenticated viewer.
  const { user } = await getData<{ user: UserSummary & { usersPost: BackendPost[] } }>(
    `/users/${id}`,
  );
  userCache.put(user);
  return (user.usersPost ?? []).map((post) => mapPost(post, user));
}
/** Newest first; `before` is the last comment ID of the previous page. */
export async function listComments(postId: string, before?: string): Promise<CommentPage> {
  const page = await getData<{ comments: BackendComment[]; hasMore: boolean; count: number }>(
    `/posts/${postId}/comments`,
    { limit: 20, ...(before ? { before } : {}) },
  );
  if (!Array.isArray(page?.comments)) throw new ServiceError('UNKNOWN');
  return {
    comments: page.comments.flatMap((comment) => {
      const mapped = mapComment(comment);
      return mapped ? [mapped] : [];
    }),
    hasMore: page.hasMore === true,
    count: typeof page.count === 'number' ? page.count : page.comments.length,
  };
}
/** clientId makes a retried submission store the comment once. */
export async function addComment(
  post: string,
  content: string,
  clientId?: string,
): Promise<PostComment> {
  try {
    const comment = mapComment(
      unwrap<BackendComment>(
        (
          await apiClient.post('/posts/comment', {
            post,
            content: content.trim(),
            ...(clientId ? { clientId } : {}),
          })
        ).data,
      ),
    );
    if (!comment) throw new ServiceError('UNKNOWN');
    return comment;
  } catch (error) {
    throw serviceError(error);
  }
}
/** Resolves the post's remaining comment count. */
export async function deleteComment(postId: string, commentId: string): Promise<number | null> {
  try {
    const result = unwrap<{ commentCount?: number }>(
      (await apiClient.delete(`/posts/${postId}/comment/${commentId}`)).data,
    );
    return typeof result.commentCount === 'number' ? result.commentCount : null;
  } catch (error) {
    throw serviceError(error);
  }
}
export async function deletePost(postId: string): Promise<void> {
  try {
    unwrap((await apiClient.delete(`/posts/${postId}`)).data);
  } catch (error) {
    throw serviceError(error);
  }
}
export const realFeedService: FeedService = {
  async listPage(skip) {
    const data = await getData<{ posts: BackendPost[]; count: number }>('/posts/public/feeds', {
      limit: FEED_PAGE,
      skip,
      sortBy: 'createdAt',
      order: 'desc',
    });
    if (!Array.isArray(data?.posts)) throw new ServiceError('UNKNOWN');
    return {
      posts: data.posts.map((post) => mapPost(post)),
      count: typeof data.count === 'number' ? data.count : data.posts.length,
    };
  },
  async create(input) {
    if (!input.assets?.length)
      throw new ServiceError('VALIDATION', 'Choose a photo before posting.');
    try {
      const photoIds: string[] = [];
      for (const asset of input.assets) photoIds.push(await uploadPhoto(asset, input.onUploadProgress));
      const response = await apiClient.post('/posts', {
        caption: input.body,
        contentVisibility: input.contentVisibility ?? 'normal',
        visibility:
          input.audience === 'everyone'
            ? 'public'
            : input.audience === 'private'
              ? 'private'
              : 'friends',
        photoIds,
        clientId: input.clientId || createClientId(),
      });
      return mapPost(unwrap<BackendPost>(response.data));
    } catch (error) {
      throw serviceError(error);
    }
  },
  async setLiked(id, liked) {
    try {
      const response = liked
        ? await apiClient.post(`/posts/${id}/like`)
        : await apiClient.delete(`/posts/${id}/unlike`);
      const state = unwrap<{ liked?: boolean; likeCount?: number }>(response.data);
      return typeof state.liked === 'boolean' && typeof state.likeCount === 'number'
        ? { liked: state.liked, likeCount: state.likeCount }
        : undefined;
    } catch (error) {
      throw serviceError(error);
    }
  },
};
