import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, unwrap } from '@/services/api/backend';
import { ServiceError } from '@/services/errors';
import type { ActivityService } from './activityService';
import type { AppNotification } from '../types';

type Row = {
  _id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
  sender?: { _id: string; displayname?: string; avatar?: string } | null;
  eventId?: string;
};
const objectId = (value?: string) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
export const realActivityService: ActivityService = {
  async list(before) {
    const page = await getData<{ notifications: Row[]; nextCursor?: string; unreadCount: number }>(
      '/notifications',
      before ? { before } : undefined,
    );
    if (
      !Array.isArray(page.notifications) ||
      !Number.isFinite(page.unreadCount) ||
      page.unreadCount < 0 ||
      (page.nextCursor !== undefined && !objectId(page.nextCursor))
    )
      throw new ServiceError('UNKNOWN');
    const items = page.notifications.map((row): AppNotification => {
      if (
        !objectId(row._id) ||
        typeof row.message !== 'string' ||
        !Number.isFinite(Date.parse(row.createdAt)) ||
        typeof row.read !== 'boolean'
      )
        throw new ServiceError('UNKNOWN');
      return {
        id: row._id,
        kind: row.sender ? 'message' : 'system',
        actor: {
          id: objectId(row.sender?._id) ? row.sender!._id : '',
          name: row.sender?.displayname || 'DARKFANTASY',
          avatarUri: mediaUrl(row.sender?.avatar),
        },
        text: row.message,
        createdAt: row.createdAt,
        read: row.read,
        ...(objectId(row.eventId) ? { eventId: row.eventId } : {}),
      };
    });
    return { items, nextCursor: page.nextCursor, unreadCount: page.unreadCount };
  },
  async markRead(ids) {
    unwrap((await apiClient.patch('/notifications/read', ids ? { ids } : {})).data);
  },
};
