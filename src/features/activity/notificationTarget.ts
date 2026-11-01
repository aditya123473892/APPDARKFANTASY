export type NotificationNavigation = { conversationId?: string; profileId?: string; requestId?: string; eventId?: string; recipientId?: string };
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
/** Treat push payloads as untrusted; never navigate to an arbitrary supplied URL. */
export function notificationTarget(data?: NotificationNavigation): string | undefined {
  if (!data) return;
  if (id(data.eventId)) return '/events/' + data.eventId;
  if (typeof data.conversationId === 'string' && /^user:[a-f\d]{24}$/i.test(data.conversationId))
    return '/chat/' + data.conversationId;
  if (id(data.requestId)) return '/activity';
  if (id(data.profileId)) return '/profile/' + data.profileId;
}
