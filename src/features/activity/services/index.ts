import type { ActivityService } from './activityService';

// Single implementation swap point for notifications.
// No notification routes are registered in the backend. Never substitute fixtures.
export const activityService: ActivityService = { list: async () => [], markRead: async () => {} };
