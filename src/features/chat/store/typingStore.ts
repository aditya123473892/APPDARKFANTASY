import { create } from 'zustand';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';

/** An indicator disappears this long after the last "typing" event, even if "stopped" never arrives. */
export const TYPING_TTL_MS = 6000;

type TypingState = {
  /** conversation key -> user ID -> expiry timestamp */
  typing: Record<string, Record<string, number>>;
};

export const useTypingStore = create<TypingState>(() => ({ typing: {} }));
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function setTyping(key: string, userId: string, active: boolean): void {
  const timerKey = `${key}|${userId}`;
  clearTimeout(timers.get(timerKey));
  timers.delete(timerKey);
  useTypingStore.setState((state) => {
    const users = { ...state.typing[key] };
    if (active) users[userId] = Date.now() + TYPING_TTL_MS;
    else delete users[userId];
    return { typing: { ...state.typing, [key]: users } };
  });
  if (active)
    timers.set(
      timerKey,
      setTimeout(() => setTyping(key, userId, false), TYPING_TTL_MS),
    );
}

/** IDs of people currently typing in a conversation. */
export function useTypingUsers(key: string): string[] {
  const users = useTypingStore((state) => state.typing[key]);
  return users ? Object.keys(users) : [];
}

registerSessionTeardown(() => {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  useTypingStore.setState({ typing: {} });
});
