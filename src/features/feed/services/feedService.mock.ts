import { db, respond } from '@/mocks/db';
import type { FeedService } from './feedService';

export const mockFeedService: FeedService = {
  list: () => respond(() => db.posts()),
  create: ({ body, audience }) => respond(() => db.createPost(body, audience), 500),
  setLiked: (postId, liked) => respond(() => db.setLiked(postId, liked), 250),
};
