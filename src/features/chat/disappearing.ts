/** Disappearing-message timers the server accepts (MESSAGE_TTL_SECONDS in the backend). */
export const MESSAGE_TIMERS = [
  { seconds: 30, label: '30 seconds', short: '30s' },
  { seconds: 300, label: '5 minutes', short: '5m' },
  { seconds: 3600, label: '1 hour', short: '1h' },
  { seconds: 86400, label: '1 day', short: '1d' },
  { seconds: 604800, label: '1 week', short: '1w' },
] as const;

export const timerShortLabel = (seconds: number | null): string | null =>
  MESSAGE_TIMERS.find((timer) => timer.seconds === seconds)?.short ?? null;

/** Compact time left, e.g. "45s", "12m", "3h", "2d". */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}h`;
  return `${Math.ceil(seconds / 86400)}d`;
}
