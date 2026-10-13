/** Centralised TanStack Query keys so invalidation stays consistent across features. */
export const queryKeys = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  requests: ['requests'] as const,
  feed: ['feed'] as const,
  notifications: ['notifications'] as const,
  discover: ['profiles', 'discover'] as const,
  profile: (id: string) => ['profiles', id] as const,
};
