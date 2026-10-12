import { mockUsers } from './users';
export type Chat = {
  id: string;
  participantId: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
  online: boolean;
  typing?: boolean;
};
export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
};
export const mockChats: Chat[] = mockUsers
  .slice(0, 5)
  .map((user, index) => ({
    id: `c${index + 1}`,
    participantId: user.id,
    lastMessage: [
      'That tiny café sounds perfect.',
      'Your playlist is dangerously good ✨',
      'Saturday works for me!',
      'I just sent the photo.',
      'Okay, now I need the full story.',
    ][index]!,
    updatedAt: new Date(Date.now() - (index + 1) * 900_000).toISOString(),
    unreadCount: index < 2 ? index + 1 : 0,
    online: index % 2 === 0,
    typing: index === 0,
  }));
export const mockMessages: Message[] = [
  {
    id: 'msg1',
    chatId: 'c1',
    senderId: 'u1',
    text: 'Your photo from the night market is beautiful.',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
    status: 'read',
  },
  {
    id: 'msg2',
    chatId: 'c1',
    senderId: 'me',
    text: 'Thank you! It was one of those perfect evenings.',
    createdAt: new Date(Date.now() - 6_900_000).toISOString(),
    status: 'read',
  },
  {
    id: 'msg3',
    chatId: 'c1',
    senderId: 'u1',
    text: 'There is a tiny café nearby with live jazz on Fridays.',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    status: 'read',
  },
  {
    id: 'msg4',
    chatId: 'c1',
    senderId: 'me',
    text: 'That sounds exactly like my kind of place.',
    createdAt: new Date(Date.now() - 3_300_000).toISOString(),
    status: 'delivered',
  },
  {
    id: 'msg5',
    chatId: 'c1',
    senderId: 'u1',
    text: 'That tiny café sounds perfect.',
    createdAt: new Date(Date.now() - 900_000).toISOString(),
    status: 'read',
  },
];
