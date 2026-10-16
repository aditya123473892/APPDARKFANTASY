import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';
import { userCache, senderId } from '@/features/auth/userCache';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { ServiceError } from '@/services/errors';
import type { ChatMedia, Message } from '../types';

export type BackendMessage = {
  _id: string;
  sender: string | UserSummary;
  receiver?: string | UserSummary;
  groupId?: string;
  message?: string;
  sentAt: string;
  isRead?: boolean;
  media?: ChatMedia[];
  expiresAt?: string;
  viewOnce?: boolean;
  viewedAt?: string;
};
export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const date = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function parseUserSummary(value: unknown): UserSummary | null {
  const raw = record(value);
  if (!raw || !isObjectId(raw._id)) return null;
  const safe: UserSummary = { _id: raw._id };
  for (const key of ['displayname', 'avatar', 'username', 'firstName', 'lastName'] as const) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (typeof raw[key] !== 'string' || raw[key].length > 4096) return null;
    safe[key] = raw[key];
  }
  return safe;
}
function identity(value: unknown): string | UserSummary | null {
  return isObjectId(value) ? value : parseUserSummary(value);
}
export function parseMessage(value: unknown): BackendMessage | null {
  const raw = record(value);
  if (!raw || !isObjectId(raw._id) || !date(raw.sentAt)) return null;
  const sender = identity(raw.sender);
  const receiver = raw.receiver == null ? undefined : identity(raw.receiver);
  const groupId = raw.groupId == null ? undefined : raw.groupId;
  if (!sender || receiver === null || (groupId !== undefined && !isObjectId(groupId))) return null;
  if (Boolean(receiver) === Boolean(groupId)) return null;
  if (raw.message != null && (typeof raw.message !== 'string' || raw.message.length > 10000))
    return null;
  if (raw.isRead !== undefined && typeof raw.isRead !== 'boolean') return null;
  if (raw.media != null && !Array.isArray(raw.media)) return null;
  if (raw.expiresAt != null && !date(raw.expiresAt)) return null;
  if (raw.viewedAt != null && !date(raw.viewedAt)) return null;
  if (raw.viewOnce != null && typeof raw.viewOnce !== 'boolean') return null;
  const media: ChatMedia[] = [];
  for (const value of (raw.media ?? []) as unknown[]) {
    const item = record(value);
    if (!item || !isObjectId(item._id)) return null;
    if (typeof item.mimetype !== 'string' || !/^(image|video)\/[a-z0-9.+-]+$/i.test(item.mimetype))
      return null;
    if (
      item.originalname != null &&
      (typeof item.originalname !== 'string' || item.originalname.length > 4096)
    )
      return null;
    if (item.status != null && !['active', 'revoked', 'quarantined'].includes(String(item.status)))
      return null;
    if (item.expiresAt != null && !date(item.expiresAt)) return null;
    if (item.revokedAt != null && !date(item.revokedAt)) return null;
    media.push({
      _id: item._id,
      mimetype: item.mimetype,
      originalname: typeof item.originalname === 'string' ? item.originalname : undefined,
      status: typeof item.status === 'string' ? item.status : 'active',
      expiresAt: typeof item.expiresAt === 'string' ? item.expiresAt : undefined,
      revokedAt: typeof item.revokedAt === 'string' ? item.revokedAt : undefined,
    });
  }
  return {
    _id: raw._id,
    sender,
    receiver: receiver ?? undefined,
    groupId: groupId as string | undefined,
    message: typeof raw.message === 'string' ? raw.message : '',
    sentAt: raw.sentAt,
    isRead: raw.isRead === true,
    media,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : undefined,
    viewOnce: raw.viewOnce === true || undefined,
    viewedAt: typeof raw.viewedAt === 'string' ? raw.viewedAt : undefined,
  };
}
/** View-once content must never appear in an inbox preview. */
export function previewText(message: {
  text?: string;
  message?: string;
  media?: ChatMedia[];
  viewOnce?: boolean;
}): string {
  if (message.viewOnce)
    return message.media?.[0]?.mimetype?.startsWith('video/')
      ? 'View-once video'
      : 'View-once photo';
  return message.text || message.message || (message.media?.length ? 'Attachment' : '');
}
export function conversationKey(raw: BackendMessage): string | null {
  if (raw.groupId) return `group:${raw.groupId}`;
  const me = sessionIdentity.userId;
  const from = senderId(raw.sender);
  const to = raw.receiver ? senderId(raw.receiver) : null;
  if (!me || !to || (from !== me && to !== me)) return null;
  return `user:${from === me ? to : from}`;
}
export function mapMessage(value: unknown, key: string): Message {
  const raw = parseMessage(value);
  if (!raw || conversationKey(raw) !== key) throw new ServiceError('UNKNOWN');
  if (typeof raw.sender === 'object') userCache.put(raw.sender);
  if (typeof raw.receiver === 'object') userCache.put(raw.receiver);
  const user = userCache.get(senderId(raw.sender));
  return {
    id: raw._id,
    conversationId: key,
    senderId: senderId(raw.sender),
    senderName: user ? displayName(user) : undefined,
    text: raw.message ?? '',
    createdAt: raw.sentAt,
    status: !raw.groupId && raw.isRead ? 'read' : 'sent',
    media: raw.media ?? [],
    ...(raw.expiresAt ? { expiresAt: raw.expiresAt } : {}),
    ...(raw.viewOnce ? { viewOnce: true } : {}),
    ...(raw.viewedAt ? { viewedAt: raw.viewedAt } : {}),
  };
}
