import { create } from 'zustand';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';

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
  status: 'sending' | 'failed-definitive' | 'uncertain';
  resync?: 'present' | 'absent';
  baselineIds?: string[];
};

type OutboxState = {
  items: Record<string, OutboxItem>;
  upsert: (item: OutboxItem) => void;
  setStatus: (clientId: string, status: OutboxItem['status']) => void;
  setResync: (clientId: string, resync: OutboxItem['resync']) => void;
  remove: (clientId: string) => void;
  clear: () => void;
};

export const useOutbox = create<OutboxState>((set) => ({
  items: {},
  upsert: (item) => set((state) => ({ items: { ...state.items, [item.clientId]: item } })),
  setResync: (clientId, resync) =>
    set((state) => {
      const item = state.items[clientId];
      return item ? { items: { ...state.items, [clientId]: { ...item, resync } } } : state;
    }),
  setStatus: (clientId, status) =>
    set((state) => {
      const item = state.items[clientId];
      return item
        ? { items: { ...state.items, [clientId]: { ...item, status, resync: undefined } } }
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

export function disconnectSending(): void {
  const state = useOutbox.getState();
  for (const item of Object.values(state.items))
    if (item.status === 'sending') state.setStatus(item.clientId, 'uncertain');
}
registerSessionTeardown(() => useOutbox.getState().clear());
