import type { CreatePostInput, Post } from '../types';

export interface FeedService {
  list(): Promise<Post[]>;
  create(input: CreatePostInput): Promise<Post>;
  setLiked(postId: string, liked: boolean): Promise<Post>;
}
