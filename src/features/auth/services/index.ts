import type { AuthService } from './authService';
import { realAuthService } from './authService.real';

// Phase 1 uses the canonical backend; never fall back to fixture identities.
export const authService: AuthService = realAuthService;
