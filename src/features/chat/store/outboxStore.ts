import { create } from 'zustand';

/**
 * Messages the user has sent that the server hasn't confirmed yet. Kept outside the
 * query cache so refetches never drop a pending or failed message, and keyed by
 * conversation so a message can only ever render in the conversation it was written in.
 */
export type OutboxItem = {
  clientId: string;
  conversationId: string;
  text: string;
  createdAt: string;
  status: 'sending' | 'failed';
  /** The last failure was a connection problem: resend automatically after reconnecting. */
  retryable?: boolean;
  /** Disappearing-message timer chosen when the message was written. */
  ttlSeconds?: number;
};

type OutboxState = {
  items: Record<string, OutboxItem>;
  upsert: (item: OutboxItem) => void;
  setStatus: (clientId: string, status: OutboxItem['status'], retryable?: boolean) => void;
  remove: (clientId: string) => void;
  clear: () => void;
};

export const useOutbox = create<OutboxState>((set) => ({
  items: {},
  upsert: (item) => set((state) => ({ items: { ...state.items, [item.clientId]: item } })),
  setStatus: (clientId, status, retryable) =>
    set((state) => {
      const item = state.items[clientId];
      return item
        ? { items: { ...state.items, [clientId]: { ...item, status, retryable } } }
        : state;
    }),
  remove: (clientId) =>
    set((state) => {
      if (!state.items[clientId]) return state;
      const { [clientId]: _removed, ...rest } = state.items;
      return { items: rest };
    }),
  clear: () => set({ items: {} }),
}));
