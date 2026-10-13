import { db, respond } from '@/mocks/db';
import type { RequestsService } from './requestsService';

export const mockRequestsService: RequestsService = {
  list: () => respond(() => db.requests()),
  send: (userId, options) =>
    respond(() => db.sendRequest(userId, Boolean(options?.superLike)), 400),
  accept: (requestId) => respond(() => db.acceptRequest(requestId), 400),
  decline: (requestId) => respond(() => db.removeRequest(requestId, 'incoming'), 350),
  cancel: (requestId) => respond(() => db.removeRequest(requestId, 'outgoing'), 350),
};
