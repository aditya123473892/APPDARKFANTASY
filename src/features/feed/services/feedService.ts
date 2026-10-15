import type { CreatePostInput, FeedPage, LikeState, Post } from '../types';

export interface FeedService {
  /** One page of the public feed, newest first. */
  listPage(skip: number): Promise<FeedPage>;
  create(input: CreatePostInput): Promise<Post>;
  /** Idempotent on the server; resolves the confirmed state and count. */
  setLiked(postId: string, liked: boolean): Promise<LikeState | void>;
}
