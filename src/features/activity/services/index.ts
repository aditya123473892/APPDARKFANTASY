import type { ActivityService } from './activityService';
import { mockActivityService } from './activityService.mock';

// Single implementation swap point for notifications.
export const activityService: ActivityService = mockActivityService;
