import type { RequestsService } from './requestsService';
import { realRequestsService } from './requestsService.real';

// Single implementation swap point for connection requests.
export const requestsService: RequestsService = realRequestsService;
