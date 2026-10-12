import type { AuthService } from './authService';
import { mockAuthService } from './authService.mock';

// Single implementation swap point. Replace with realAuthService during backend integration.
export const authService: AuthService = mockAuthService;
