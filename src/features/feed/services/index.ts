import type { FeedService } from './feedService';
import { mockFeedService } from './feedService.mock';

// Single implementation swap point for posts.
export const feedService: FeedService = mockFeedService;
