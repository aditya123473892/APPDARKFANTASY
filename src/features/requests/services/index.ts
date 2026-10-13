import type { RequestsService } from './requestsService';
import { mockRequestsService } from './requestsService.mock';

// Single implementation swap point for connection requests.
export const requestsService: RequestsService = mockRequestsService;
