import { currentUser, mockUsers } from '@/mocks/users';
import { mockImages } from '@/mocks/images';

export type Post = {
  id: string;
  user: { id: string; name: string; handle: string; avatarUri: string; verified?: boolean };
  body: string;
  createdAt: string;
  media?: string[];
  likes: number;
  replies: number;
  reposts: number;
  liked?: boolean;
  replierAvatars?: string[];
};

const authors = [currentUser, ...mockUsers];
const copy = [
  'The best dates feel less like an interview and more like finding a new favorite song. #slowdating',
  'Found a tiny listening bar with exactly eight seats. Who is coming with me? @nightowls',
  'A reminder: chemistry is lovely, but feeling safe enough to be fully yourself is the real spark.',
  'Sunday plan: coffee, a long walk, and nowhere else to be. What does your perfect quiet day look like?',
];

export const posts: Post[] = copy.map((body, index) => {
  const author = authors[index]!;
  return {
    id: `post-${index + 1}`,
    user: { id: author.id, name: author.name, handle: author.name.toLowerCase().replace(/\s/g, ''), avatarUri: author.avatarUri, verified: index < 2 },
    body,
    createdAt: `${index + 1}h`,
    media: index === 1 ? [mockImages[1]!, mockImages[3]!] : index === 3 ? [mockImages[4]!] : undefined,
    likes: 148 - index * 27,
    replies: 12 - index * 2,
    reposts: 8 + index,
    liked: index === 2,
    replierAvatars: [mockUsers[(index + 1) % mockUsers.length]!.avatarUri, mockUsers[(index + 2) % mockUsers.length]!.avatarUri],
  };
});

export type ActivityItem = { id: string; kind: 'match' | 'like' | 'reply'; userId: string; text: string; time: string };
export const activities: ActivityItem[] = [
  { id: 'a1', kind: 'match', userId: 'u1', text: 'You matched. Say hello!', time: '2m' },
  { id: 'a2', kind: 'like', userId: 'u2', text: 'liked your post', time: '1h' },
  { id: 'a3', kind: 'reply', userId: 'u3', text: 'replied: “This is exactly it.”', time: '3h' },
  { id: 'a4', kind: 'like', userId: 'u4', text: 'liked your profile', time: '1d' },
];
