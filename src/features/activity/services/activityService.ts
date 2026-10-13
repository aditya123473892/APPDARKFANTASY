import type { AppNotification } from '../types';

export interface ActivityService {
  list(): Promise<AppNotification[]>;
  /** Marks the given notifications read, or all of them when no ids are passed. */
  markRead(ids?: string[]): Promise<void>;
}
