const MINUTE = 60_000;
const DAY = 86_400_000;
// Built once: creating an Intl formatter is slow on Hermes, and these run for every list row.
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const shortDateWithYear = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const clockTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

export function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / MINUTE);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return shortDate.format(new Date(date));
}

export function formatMessageTime(date: string): string {
  return clockTime.format(new Date(date));
}

const startOfDay = (value: Date): number =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

/** "Today", "Yesterday", weekday within a week, otherwise a short date. */
export function formatDayLabel(date: string): string {
  const value = new Date(date);
  const days = Math.round((startOfDay(new Date()) - startOfDay(value)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekday.format(value);
  return (value.getFullYear() === new Date().getFullYear() ? shortDate : shortDateWithYear).format(
    value,
  );
}

export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** Presence line for chat headers. Returns null when nothing should be shown. */
export function formatPresence(
  presence: { online: boolean; lastSeenAt: string | null } | null,
): string | null {
  if (!presence) return null;
  if (presence.online) return 'Online now';
  if (!presence.lastSeenAt) return null;
  return `Active ${formatTimeAgo(presence.lastSeenAt)}`;
}

export function formatDistance(km: number | undefined): string | null {
  if (km === undefined) return null;
  return km < 1 ? 'Less than 1 km away' : `${Math.round(km)} km away`;
}

export function toHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** "just now", "5m ago", "3d ago", or "on Oct 3" for older dates. */
export function formatTimeAgo(date: string): string {
  const relative = formatRelativeTime(date);
  if (relative === 'now') return 'just now';
  return /^\d+[mhd]$/.test(relative) ? `${relative} ago` : `on ${relative}`;
}

/** "Oct 3". */
export function formatShortDate(date: string): string {
  return shortDate.format(new Date(date));
}
