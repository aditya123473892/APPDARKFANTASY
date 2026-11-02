import { create } from 'zustand';
import { env } from '@/config/env';
import { initializePinning } from './pinning';

/**
 * The hosted backend sleeps when idle and takes up to about a minute to wake, far longer than
 * the API client's 15 s timeout. Requests wait for a wake-up check instead of failing, and
 * the app explains the delay while it lasts.
 */
const WAKE_TIMEOUT_MS = 90_000;
/** Only say "waking up" when it is actually slow. */
const SLOW_MS = 3_000;
/** The server sleeps after about 15 minutes without traffic; check again after 10. */
const STALE_MS = 10 * 60_000;

export const useServerWake = create(() => ({ waking: false }));
let pending: Promise<void> | null = null;
let lastSeen = 0;

/** Any successful API response proves the server is awake. */
export function markServerAwake(): void {
  lastSeen = Date.now();
}

/** Resolves once the server answers (or the check gives up); immediate while it is known to be awake. */
export function wakeServer(): Promise<void> {
  if (pending) return pending;
  if (Date.now() - lastSeen < STALE_MS) return Promise.resolve();
  const slow = setTimeout(() => useServerWake.setState({ waking: true }), SLOW_MS);
  const controller = new AbortController();
  const giveUp = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);
  pending = (async () => {
    try {
      await initializePinning();
      const response = await fetch(`${env.apiUrl}/health/live`, {
        headers: { 'Cache-Control': 'no-store' },
        signal: controller.signal,
      });
      if (response.ok) markServerAwake();
    } catch {
      // Offline or still asleep: requests go ahead and report their own errors.
    } finally {
      clearTimeout(slow);
      clearTimeout(giveUp);
      useServerWake.setState({ waking: false });
      pending = null;
    }
  })();
  return pending;
}
