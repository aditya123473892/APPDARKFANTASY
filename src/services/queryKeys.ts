/** Centralised TanStack Query keys so invalidation stays consistent across features. */
export const queryKeys = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  group: (id: string) => ['chat', 'group', id] as const,
  comments: (postId: string) => ['posts', postId, 'comments'] as const,
  requests: ['requests'] as const,
  feed: ['feed'] as const,
  myPosts: ['my-posts'] as const,
  userPosts: (id: string) => ['user-posts', id] as const,
  notifications: ['notifications'] as const,
  discover: ['profiles', 'discover'] as const,
  profile: (id: string) => ['profiles', id] as const,
};
