import type { ProfileService } from './profileService';
import { realProfileService } from './profileService.real';

// Single implementation swap point for profiles and discovery.
export const profileService: ProfileService = realProfileService;
