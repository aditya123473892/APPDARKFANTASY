import type { FeedService } from './feedService';
import { realFeedService } from './feedService.real';

// Single implementation swap point for posts.
export const feedService: FeedService = realFeedService;
