import { mockUsers } from './users';
export type Match = {
  id: string;
  userId: string;
  matchedAt: string;
  likesYou: boolean;
  isNew: boolean;
};
export const mockMatches: Match[] = mockUsers.map((user, index) => ({
  id: `m${index + 1}`,
  userId: user.id,
  matchedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  likesYou: index < 3,
  isNew: index < 2,
}));
