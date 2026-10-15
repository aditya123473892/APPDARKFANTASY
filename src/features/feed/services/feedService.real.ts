import { apiClient } from '@/services/api/apiClient';
import { getCollection, getData, mediaUrl, unwrap, serviceError } from '@/services/api/backend';
import { appendAsset } from '@/services/api/multipart';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { userCache } from '@/features/auth/userCache';
import { displayName, type UserSummary } from '@/features/auth/userModel';
import { ServiceError } from '@/services/errors';
import type { Post } from '../types';
import type { FeedService } from './feedService';
export type BackendPost = {
  _id: string;
  caption?: string;
  user: string | UserSummary;
  createdAt: string;
  visibility?: string;
  status?: string;
  media?: { url?: string; mimetype?: string }[];
  likes?: (string | { user?: string | UserSummary })[];
  comments?: (string | { _id: string; content?: string; user?: string | UserSummary })[];
  likeCount?: number;
  commentCount?: number;
};
export function mapPost(raw: BackendPost, author?: UserSummary): Post {
  if (!raw?._id || !raw.createdAt) throw new ServiceError('UNKNOWN');
  const user =
    typeof raw.user === 'object' && raw.user
      ? raw.user
      : (author ?? userCache.get(String(raw.user)));
  if (user) userCache.put(user);
  return {
    id: raw._id,
    body: raw.caption ?? '',
    createdAt: raw.createdAt,
    user: {
      id: user?._id ?? String(raw.user ?? ''),
      name: user ? displayName(user) : 'Unavailable user',
      handle: user?.displayname ?? '',
      avatarUri: mediaUrl(user?.avatar),
    },
    media: (raw.media ?? [])
      .filter((m) => mediaUrl(m.url))
      .map((m) => ({ uri: mediaUrl(m.url), width: 16, height: 12, mimetype: m.mimetype })),
    likes: raw.likeCount ?? raw.likes?.length ?? 0,
    replies: raw.commentCount ?? raw.comments?.length ?? 0,
    liked: (raw.likes ?? []).some(
      (like) =>
        typeof like === 'object' &&
        (typeof like.user === 'object' ? like.user?._id : like.user) === sessionIdentity.userId,
    ),
    likeStateKnown: (raw.likes ?? []).every(
      (like) => typeof like === 'object' && Boolean(like.user),
    ),
    comments: (raw.comments ?? []).flatMap((comment) => {
      if (typeof comment === 'string' || typeof comment.content !== 'string') return [];
      const author =
        typeof comment.user === 'object' && comment.user
          ? comment.user
          : userCache.get(comment.user ?? '');
      if (author) userCache.put(author);
      return [
        {
          id: comment._id,
          content: comment.content,
          author: {
            id: author?._id ?? String(comment.user ?? ''),
            name: author ? displayName(author) : 'Unavailable user',
            handle: author?.displayname ?? '',
            avatarUri: mediaUrl(author?.avatar),
          },
        },
      ];
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
  const { user } = await getData<{ user: UserSummary & { usersPost: BackendPost[] } }>(
    `/users/${id}`,
    { viewerId: sessionIdentity.userId },
  );
  userCache.put(user);
  return (user.usersPost ?? []).map((post) => mapPost(post, user));
}
export async function addComment(post: string, content: string): Promise<void> {
  try {
    unwrap((await apiClient.post('/posts/comment', { post, content: content.trim() })).data);
  } catch (error) {
    throw serviceError(error);
  }
}
export const realFeedService: FeedService = {
  async list() {
    return (await getCollection<BackendPost>('/posts/public/feeds', 'posts'))
      .map((post) => mapPost(post))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(input) {
    if (!input.assets?.length)
      throw new ServiceError('VALIDATION', 'Choose a photo or video before posting.');
    const form = new FormData();
    form.append('caption', input.body);
    form.append(
      'visibility',
      input.audience === 'everyone'
        ? 'public'
        : input.audience === 'private'
          ? 'private'
          : 'friends',
    );
    input.assets.forEach((asset) => appendAsset(form, asset));
    try {
      const response = await apiClient.post('/posts', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return mapPost(unwrap<BackendPost>(response.data));
    } catch (error) {
      throw serviceError(error);
    }
  },
  async setLiked(id, liked) {
    try {
      if (liked) await apiClient.post(`/posts/${id}/like`);
      else await apiClient.delete(`/posts/${id}/unlike`);
    } catch (error) {
      throw serviceError(error);
    }
  },
};
