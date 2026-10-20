import type { UserSummary } from './userModel';
import { registerSessionTeardown } from './sessionRuntime';
const users = new Map<string, Readonly<UserSummary>>();
export const USER_CACHE_LIMIT = 200;
export const userCache = {
  get: (id: string) => users.get(id),
  put: (user: UserSummary) => {
    if (!user._id) return;
    const previous = users.get(user._id);
    users.delete(user._id);
    // Explicit allowlist: never cache a full /auth/me response or private fields.
    const safe = { ...previous, _id: user._id } as UserSummary;
    for (const key of ['displayname', 'avatar', 'username', 'firstName', 'lastName'] as const)
      if (typeof user[key] === 'string') safe[key] = user[key];
    users.set(user._id, Object.freeze(safe));
    if (users.size > USER_CACHE_LIMIT) users.delete(users.keys().next().value!);
  },
  clear: () => users.clear(),
  remove: (id: string) => users.delete(id),
  size: () => users.size,
};
registerSessionTeardown(userCache.clear);
export const senderId = (sender: string | UserSummary): string =>
  typeof sender === 'string' ? sender : sender._id;
