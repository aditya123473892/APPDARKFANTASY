export type PostAuthor = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
  verified?: boolean;
};
export type PostMedia = { uri: string; width: number; height: number };
export type PostAudience = 'everyone' | 'connections';

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
};

export type CreatePostInput = { body: string; audience: PostAudience };
