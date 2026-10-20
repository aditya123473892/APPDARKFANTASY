import type { UserView as User } from '@/features/auth/types';
import type { ProfileView, UpdateProfileInput } from '../types';
import type { UploadAsset } from '@/features/feed/types';

export type DiscoveryPage = { profiles: ProfileView[]; nextSkip?: number };

export interface ProfileService {
  discover(): Promise<ProfileView[]>;
  discoverPage(skip: number, search: string): Promise<DiscoveryPage>;
  /** Throws ServiceError('NOT_FOUND') for unknown or unavailable profiles. */
  get(userId: string): Promise<ProfileView>;
  updateMe(input: UpdateProfileInput): Promise<User>;
  updateAvatar(asset: UploadAsset): Promise<User>;
}
