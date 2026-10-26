export type PostAuthor = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
  verified?: boolean;
};
export type ContentVisibility = 'normal' | 'premium';
/** Allowlisted wire image response shared by feed, profiles and post mutations. */
export type PostImageResponse = {
  id: string;
  url: string;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  /** width / height, null until the server has the size (older posts before backfill). */
  aspectRatio?: number | null;
};
export type PostMedia = {
  id?: string;
  uri: string;
  blurhash?: string | null;
  width: number;
  height: number;
  mimetype?: string;
  /** Premium content the viewer is not subscribed to; videos then have no URL. */
  locked?: boolean;
};
export type PostAudience = 'everyone' | 'connections' | 'private';
export type PostComment = {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt?: string;
  /** Local only: shown while the server has not confirmed it yet. */
  pending?: boolean;
};

export type Post = {
  contentVisibility?: ContentVisibility;
  locked?: boolean;
  id: string;
  user: PostAuthor;
  body: string;
  createdAt: string;
  media?: PostMedia[];
  likes: number;
  replies: number;
  liked: boolean;
  audience: PostAudience;
  status?: string;
  likeStateKnown?: boolean;
  comments?: PostComment[];
};

export type FeedPage = { posts: Post[]; count: number };
export type LikeState = { liked: boolean; likeCount: number };
export type CommentPage = { comments: PostComment[]; hasMore: boolean; count: number };

export type UploadAsset = {
  uri: string;
  name: string;
  type: string;
  file?: File;
  /** Explicitly selected, verified copy from the vault; avoid importing it again. */
  fromVault?: boolean;
};
export type CreatePostInput = {
  contentVisibility?: ContentVisibility;
  onUploadProgress?: import('@/services/api/uploadProgress').UploadProgressListener;
  clientId?: string;
  body: string;
  audience: PostAudience;
  assets?: UploadAsset[];
};
