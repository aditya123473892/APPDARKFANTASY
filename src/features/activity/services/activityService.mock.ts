import { db, respond } from '@/mocks/db';
import type { ActivityService } from './activityService';

export const mockActivityService: ActivityService = {
  list: () => respond(() => db.notifications()),
  markRead: (ids) => respond(() => db.markNotificationsRead(ids), 200),
};
