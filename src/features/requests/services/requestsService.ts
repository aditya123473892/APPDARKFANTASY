import type { RequestsResult, SendRequestResult } from '../types';

export interface RequestsService {
  list(): Promise<RequestsResult>;
  send(userId: string, options?: { superLike?: boolean }): Promise<SendRequestResult>;
  /** Accepting creates the connection and returns its conversation. */
  accept(requestId: string): Promise<{ conversationId: string }>;
  decline(requestId: string): Promise<void>;
  cancel(requestId: string): Promise<void>;
}
