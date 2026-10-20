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
  discoverPage: (skip, search) =>
    respond(() => {
      const profiles = db.discoverable().map(view)
        .filter((user) => user.name.toLowerCase().includes(search.toLowerCase()));
      const next = skip + 20;
      return {
        profiles: profiles.slice(skip, next),
        nextSkip: next < profiles.length ? next : undefined,
      };
    }),
  get: (userId) => respond(() => view(db.user(userId)), 300),
  updateMe: (input) => respond(() => db.updateMe(input), 600),
  updateAvatar: (asset) =>
    respond(() => db.updateMe({ avatarUri: asset.uri, photos: [asset.uri] }), 600),
};
