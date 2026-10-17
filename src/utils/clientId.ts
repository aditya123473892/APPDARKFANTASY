/**
 * URL-safe idempotency key (8–64 of [A-Za-z0-9_-]), generated once per user
 * action and reused when that action is retried, so the server stores it once.
 */
export const createClientId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** The backend's accepted idempotency-key format (CreateChatMessageDto.clientId). */
export const isClientId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
