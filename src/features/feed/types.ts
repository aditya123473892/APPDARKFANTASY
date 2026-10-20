export type PostAuthor = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
  verified?: boolean;
};
export type PostMedia = { uri: string; width: number; height: number; mimetype?: string };
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

export type UploadAsset = { uri: string; name: string; type: string; file?: File };
export type CreatePostInput = {
  onUploadProgress?: import('@/services/api/uploadProgress').UploadProgressListener;
  clientId?: string;
  body: string;
  audience: PostAudience;
  assets?: UploadAsset[];
};
