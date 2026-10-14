import { ServiceError } from '@/services/errors';

let generation = 0;
let token: string | null = null;
let onInvalid: ((blocked: boolean) => Promise<void>) | undefined;
const teardown = new Set<() => void>();
let userId: string | null = null;
export const sessionIdentity = Object.freeze({
  get generation(): number {
    return generation;
  },
  get userId(): string | null {
    return userId;
  },
  getToken: () => token,
  subscribe: registerSessionTeardown,
});
export function setSessionIdentity(id: string, value: string): void {
  if (userId && userId !== id) teardownSession();
  userId = id;
  setRuntimeToken(value);
}
let forbidden: (() => Promise<void>) | undefined;
export function registerForbidden(handler: () => Promise<void>): void {
  forbidden = handler;
}
export async function notifyForbidden(authorization: unknown): Promise<void> {
  if (token && authorization === `Bearer ${token}`) await forbidden?.();
}
export const getRuntimeToken = (): string | null => token;
export function setRuntimeToken(value: string | null): void {
  if (token !== value) generation++;
  token = value;
}
/** A generation also distinguishes a new login to the same account. */
export function isSessionCurrent(scope: number): boolean {
  return scope === generation && Boolean(userId && token);
}
export function assertSessionCurrent(scope: number): void {
  if (!isSessionCurrent(scope)) throw new ServiceError('FORBIDDEN', 'Session ended');
}
export function registerSessionInvalidation(handler: (blocked: boolean) => Promise<void>): void {
  onInvalid = handler;
}
export function registerSessionTeardown(handler: () => void): () => void {
  teardown.add(handler);
  return () => {
    teardown.delete(handler);
  };
}
export function teardownSession(): void {
  generation++;
  token = null;
  userId = null;
  teardown.forEach((handler) => {
    try {
      handler();
    } catch {
      /* Clear remaining resources. */
    }
  });
}
export async function invalidateSession(authorization: unknown, blocked = false): Promise<void> {
  if (token && authorization === `Bearer ${token}`) await onInvalid?.(blocked);
}
/** Phase 2 registers socket.disconnect with registerSessionTeardown. Never use a token in a URL. */
export function getSocketHandshakeAuth(): { token: string } | null {
  return token ? { token } : null;
}
