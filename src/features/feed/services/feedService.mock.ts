import { db, respond } from '@/mocks/db';
import type { FeedService } from './feedService';

export const mockFeedService: FeedService = {
  listPage: () =>
    respond(() => {
      const posts = db.posts();
      return { posts, count: posts.length };
    }),
  create: ({ body, audience }) => respond(() => db.createPost(body, audience), 500),
  setLiked: (postId, liked) =>
    respond(() => {
      const post = db.setLiked(postId, liked);
      return { liked: post.liked, likeCount: post.likes };
    }, 250),
};
