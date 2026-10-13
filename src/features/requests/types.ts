import type { User } from '@/features/auth/types';

export type RequestDirection = 'incoming' | 'outgoing';
export type ConnectionRequest = {
  id: string;
  user: User;
  direction: RequestDirection;
  createdAt: string;
  superLike: boolean;
  /** Optional note sent with the request. */
  note?: string;
};
export type RequestsResult = { incoming: ConnectionRequest[]; outgoing: ConnectionRequest[] };
/** Sending a request to someone who already requested you connects you immediately. */
export type SendRequestResult =
  | { status: 'pending'; request: ConnectionRequest }
  | { status: 'connected'; conversationId: string };
