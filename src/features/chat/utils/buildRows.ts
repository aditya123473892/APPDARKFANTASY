import { formatDayLabel, isSameDay } from '@/utils/formatters';
import type { ChatMessage } from '../hooks/useChat';

export type ChatRow =
  | { type: 'divider'; key: string; label: string }
  | { type: 'message'; key: string; message: ChatMessage; first: boolean; last: boolean };

const GROUP_WINDOW_MS = 5 * 60_000;
const gap = (a: string, b: string): number => new Date(b).getTime() - new Date(a).getTime();

/**
 * Builds rows newest-first for an inverted list, inserting a divider before each new day and
 * marking consecutive messages from the same sender (within 5 minutes) as one visual group.
 */
type MessageRow = Extract<ChatRow, { type: 'message' }>;

/**
 * Pass the same `cache` on every call: a row whose message and grouping are unchanged is
 * returned as the same object, so the list only re-renders the cells that changed.
 */
export function buildRows(
  messages: ChatMessage[],
  cache?: WeakMap<ChatMessage, MessageRow>,
): ChatRow[] {
  const rows: ChatRow[] = [];
  messages.forEach((message, index) => {
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const newDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
    if (newDay) {
      rows.push({
        type: 'divider',
        key: `d-${message.id}`,
        label: formatDayLabel(message.createdAt),
      });
    }
    const joinsPrev =
      !newDay &&
      prev?.senderId === message.senderId &&
      gap(prev.createdAt, message.createdAt) < GROUP_WINDOW_MS;
    const joinsNext =
      !!next &&
      next.senderId === message.senderId &&
      isSameDay(next.createdAt, message.createdAt) &&
      gap(message.createdAt, next.createdAt) < GROUP_WINDOW_MS;
    const key = message.clientId ? `c-${message.clientId}` : message.id;
    const cached = cache?.get(message);
    if (cached && cached.key === key && cached.first === !joinsPrev && cached.last === !joinsNext) {
      rows.push(cached);
      return;
    }
    const row: MessageRow = { type: 'message', key, message, first: !joinsPrev, last: !joinsNext };
    cache?.set(message, row);
    rows.push(row);
  });
  return rows.reverse();
}
