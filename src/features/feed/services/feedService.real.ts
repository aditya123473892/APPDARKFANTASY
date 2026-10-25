import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { uploadPhoto } from '@/services/api/photoUpload';
import { uploadVideo } from '@/services/api/videoUpload';
import { createClientId } from '@/utils/clientId';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { userCache } from '@/features/auth/userCache';
import { displayName, type UserSummary } from '@/features/auth/userModel';
import { ServiceError } from '@/services/errors';
import type {
  CommentPage,
  ContentVisibility,
  LikeState,
  Post,
  PostAuthor,
  PostComment,
  PostImageResponse,
  PostMedia,
} from '../types';
import type { FeedService } from './feedService';
export type BackendPost = {
  _id: string;
  caption?: string;
  user: string | UserSummary;
  createdAt: string;
  visibility?: string;
  contentVisibility?: ContentVisibility;
  locked?: boolean;
  status?: string;
  /** Current API: per-image signed URL plus the stored pixel size (null for legacy uploads). */
  images?: PostImageResponse[];
  /** Moderated post videos; url is empty while the viewer lacks premium access. */
  videos?: { url?: string; contentType?: string }[];
  /** Legacy API shape, kept for older servers. */
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
/** 0 width/height means "unknown"; the gallery then measures the loaded image. */
type MediaSource = Pick<
  BackendPost,
  'images' | 'media' | 'videos' | 'contentVisibility' | 'locked'
> & {
  _id?: string;
};
export function mapPostMedia(raw: MediaSource): PostMedia[] {
  const videos: PostMedia[] = (raw.videos ?? []).map((video, index) => ({
    id: `${raw._id}:video:${index}`,
    uri: mediaUrl(video.url),
    width: 0,
    height: 0,
    mimetype: video.contentType === 'video/quicktime' ? 'video/quicktime' : 'video/mp4',
    locked: Boolean(raw.locked),
  }));
  const images = mapPostImages(raw);
  return videos.length ? [...videos, ...images] : images;
}
function mapPostImages(raw: MediaSource): PostMedia[] {
  const size = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  const locked = raw.contentVisibility === 'premium' && raw.locked !== false;
  if (raw.images)
    return raw.images
      .filter((image) => locked || !image.url || Boolean(mediaUrl(image.url)))
      .map((image, index) => ({
        id: image.id || `${raw._id}:${index}`,
        uri: mediaUrl(image.url),
        blurhash: image.blurhash,
        width: size(image.width),
        height: size(image.height),
        mimetype: 'image/jpeg',
      }));
  return (raw.contentVisibility === 'premium' ? [] : (raw.media ?? []))
    .filter((m) => mediaUrl(m.url))
    .map((m, index) => ({
      id: `${raw._id}:${index}`,
      uri: mediaUrl(m.url),
      width: 0,
      height: 0,
      mimetype: m.mimetype,
    }));
}
export function mapPost(raw: BackendPost, fallbackAuthor?: UserSummary): Post {
  if (!raw?._id || !raw.createdAt) throw new ServiceError('UNKNOWN');
  const likes = raw.likes ?? [];
  const serverState = typeof raw.likedByMe === 'boolean';
  const locked = raw.contentVisibility === 'premium' && raw.locked !== false;
  return {
    contentVisibility: raw.contentVisibility ?? 'normal',
    locked,
    id: raw._id,
    body: raw.caption ?? '',
    createdAt: raw.createdAt,
    user: author(raw.user, fallbackAuthor),
    media: mapPostMedia(raw),
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
/** Accept the current envelope and the older post-shaped like response during upgrades. */
export function mapLikeResponse(body: unknown, requested: boolean): LikeState {
  if (!body || typeof body !== 'object') throw new ServiceError('UNKNOWN');
  const envelope = body as {
    data?: unknown;
    error?: unknown;
    statusCode?: number;
    post?: BackendPost;
  };
  if (envelope.error || (envelope.statusCode ?? 200) >= 400) throw new ServiceError('UNKNOWN');
  const data = envelope.data ?? body;
  if (!data || typeof data !== 'object') throw new ServiceError('UNKNOWN');
  const value = data as { liked?: boolean; likeCount?: number; post?: BackendPost };
  if (
    typeof value.liked === 'boolean' &&
    typeof value.likeCount === 'number' &&
    Number.isFinite(value.likeCount) &&
    value.likeCount >= 0
  )
    return { liked: value.liked, likeCount: value.likeCount };
  const post = value.post;
  const count = post?.likeCount ?? post?.likes?.length;
  if (post && typeof count === 'number')
    return {
      liked: typeof post.likedByMe === 'boolean' ? post.likedByMe : requested,
      likeCount: count,
    };
  throw new ServiceError('UNKNOWN');
}

export async function getPost(id: string): Promise<Post> {
  return mapPost(await getData<BackendPost>(`/posts/${encodeURIComponent(id)}`));
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
      throw new ServiceError('VALIDATION', 'Choose a photo or video before posting.');
    try {
      const photoIds: string[] = [];
      const videoIds: string[] = [];
      for (const [index, asset] of input.assets.entries()) {
        let fraction = 0;
        const progress: typeof input.onUploadProgress = (event) => {
          fraction = Math.max(
            fraction,
            event.stage === 'complete' ? 1 : ((event.percent ?? 0) / 100) * 0.9,
          );
          input.onUploadProgress?.({
            ...event,
            percent: Math.round(((index + fraction) / input.assets!.length) * 95),
          });
        };
        if (asset.type.startsWith('video/')) videoIds.push(await uploadVideo(asset, progress));
        else photoIds.push(await uploadPhoto(asset, progress));
      }
      const response = await apiClient.post('/posts', {
        caption: input.body,
        contentVisibility: input.contentVisibility ?? 'normal',
        visibility:
          input.audience === 'everyone'
            ? 'public'
            : input.audience === 'private'
              ? 'private'
              : 'friends',
        ...(photoIds.length ? { photoIds } : {}),
        ...(videoIds.length ? { videoIds } : {}),
        clientId: input.clientId || createClientId(),
      });
      const post = mapPost(unwrap<BackendPost>(response.data));
      input.onUploadProgress?.({ stage: 'complete', percent: 100, attempt: 1 });
      return post;
    } catch (error) {
      throw serviceError(error);
    }
  },
  async setLiked(id, liked) {
    try {
      const response = liked
        ? await apiClient.post(`/posts/${id}/like`)
        : await apiClient.delete(`/posts/${id}/unlike`);
      return mapLikeResponse(response.data, liked);
    } catch (error) {
      throw serviceError(error);
    }
  },
};
