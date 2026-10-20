import type { NotificationPage } from '../types';

export interface ActivityService {
  list(before?: string): Promise<NotificationPage>;
  /** Marks the given notifications read, or all of them when no ids are passed. */
  markRead(ids?: string[]): Promise<void>;
}
