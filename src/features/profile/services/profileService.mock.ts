import { db, relationshipWith, respond } from '@/mocks/db';
import type { UserView as User } from '@/features/auth/types';
import type { ProfileView } from '../types';
import type { ProfileService } from './profileService';

const view = (user: User): ProfileView => ({
  ...user,
  relationship: relationshipWith(user.id),
  presence: db.presenceOf(user.id),
});

export const mockProfileService: ProfileService = {
  discover: () => respond(() => db.discoverable().map(view)),
  get: (userId) => respond(() => view(db.user(userId)), 300),
  updateMe: (input) => respond(() => db.updateMe(input), 600),
};
