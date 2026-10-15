import { create } from 'zustand';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';
import type { Message } from '../types';

export const LOCAL_WINDOW = 50;
type Room = { draft: string; window: number; firstUnread?: string; unreadCaptured: boolean };
const fresh = (): Room => ({ draft: '', window: LOCAL_WINDOW, unreadCaptured: false });
export const useConversationState = create<{ rooms: Record<string, Room> }>(() => ({ rooms: {} }));
export function roomState(key: string): Room {
  return useConversationState.getState().rooms[key] ?? fresh();
}
export function updateRoom(key: string, value: Partial<Room>): void {
  useConversationState.setState((state) => ({
    rooms: { ...state.rooms, [key]: { ...(state.rooms[key] ?? fresh()), ...value } },
  }));
}
/** Call synchronously from the read effect before emitting markAsRead. */
export function captureFirstUnread(key: string, rows: Message[], myId: string): string | undefined {
  if (!roomState(key).unreadCaptured) {
    const id = key.startsWith('user:')
      ? rows.find((row) => row.senderId !== myId && row.status !== 'read')?.id
      : undefined;
    updateRoom(key, { firstUnread: id, unreadCaptured: true });
  }
  return roomState(key).firstUnread;
}
export function localWindow<T>(rows: T[], count: number): T[] {
  return rows.slice(-count);
}
registerSessionTeardown(() => useConversationState.setState({ rooms: {} }));
