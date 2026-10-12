import type { User } from '@/features/auth/types';
import { mockImages } from './images';

export const currentUser: User = {
  id: 'me',
  email: 'demo@example.com',
  name: 'Alex Morgan',
  age: 27,
  bio: 'Night walks, small cafés, and finding the best live music in town.',
  interests: ['Live music', 'Travel', 'Coffee', 'Photography'],
  avatarUri: mockImages[5]!,
};

export const mockUsers: User[] = [
  {
    id: 'u1',
    email: 'maya@example.com',
    name: 'Maya',
    age: 26,
    bio: 'Ceramic artist. Always planning the next road trip.',
    interests: ['Art', 'Road trips', 'Dogs'],
    avatarUri: mockImages[0]!,
  },
  {
    id: 'u2',
    email: 'noah@example.com',
    name: 'Noah',
    age: 29,
    bio: 'Chef, climber, and amateur film photographer.',
    interests: ['Cooking', 'Climbing', 'Film'],
    avatarUri: mockImages[1]!,
  },
  {
    id: 'u3',
    email: 'lena@example.com',
    name: 'Lena',
    age: 25,
    bio: 'Designing things by day, dancing after dark.',
    interests: ['Design', 'Dance', 'Books'],
    avatarUri: mockImages[2]!,
  },
  {
    id: 'u4',
    email: 'kai@example.com',
    name: 'Kai',
    age: 28,
    bio: 'Looking for someone to split dessert with.',
    interests: ['Food', 'Running', 'Jazz'],
    avatarUri: mockImages[3]!,
  },
  {
    id: 'u5',
    email: 'ivy@example.com',
    name: 'Ivy',
    age: 27,
    bio: 'Museum weekends and spontaneous train rides.',
    interests: ['Museums', 'Travel', 'Poetry'],
    avatarUri: mockImages[4]!,
  },
];
