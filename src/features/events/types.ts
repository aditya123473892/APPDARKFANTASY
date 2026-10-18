import type { UserSummary } from '@/features/auth/userModel';

export type Event = {
  _id: string;
  name: string;
  description: string;
  theme?: string;
  startAt: string;
  endAt: string;
  type: 'online' | 'offline';
  location?: string;
  capacity?: number;
  registrationDeadline?: string;
  status: 'upcoming' | 'active' | 'canceled' | 'completed';
  creator: string | UserSummary;
  cover?: { url?: string };
  /** The listing includes all applicants, not only accepted participants. */
  users?: (string | UserSummary)[];
};
export type EventMember = {
  _id: string;
  user: UserSummary | null;
  requestStatus: 'pending' | 'accepted' | 'rejected' | 'canceled';
};
export type EventInput = Pick<
  Event,
  | 'name'
  | 'description'
  | 'theme'
  | 'startAt'
  | 'endAt'
  | 'type'
  | 'location'
  | 'capacity'
  | 'registrationDeadline'
>;
export const referenceId = (value: string | UserSummary | null | undefined) =>
  typeof value === 'string' ? value : value?._id;

export function applicationsClosed(event: Event, now = Date.now()): boolean {
  return (
    event.status === 'canceled' ||
    event.status === 'completed' ||
    Date.parse(event.endAt) <= now ||
    Boolean(event.registrationDeadline && Date.parse(event.registrationDeadline) <= now)
  );
}

/** Form dates are local wall time; the API receives ISO timestamps. */
export function parseEventDate(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const [, y, m, d, h, min] = match.map(Number);
  const date = new Date(y!, m! - 1, d!, h!, min!);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m! - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== min
  )
    return undefined;
  return date.toISOString();
}

export function localEventDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
