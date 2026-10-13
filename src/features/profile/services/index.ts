import type { ProfileService } from './profileService';
import { mockProfileService } from './profileService.mock';

// Single implementation swap point for profiles and discovery.
export const profileService: ProfileService = mockProfileService;
