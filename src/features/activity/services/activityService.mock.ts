import { db, respond } from '@/mocks/db';
import type { ActivityService } from './activityService';

export const mockActivityService: ActivityService = {
  list: () => respond(() => ({ items: db.notifications(),
    unreadCount: db.notifications().filter((item) => !item.read).length })),
  markRead: (ids) => respond(() => db.markNotificationsRead(ids), 200),
};
