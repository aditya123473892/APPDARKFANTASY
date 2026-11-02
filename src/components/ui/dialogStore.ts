import type { AlertButton, AlertOptions } from 'react-native';
import { create } from 'zustand';

/**
 * The app's dialog queue, kept free of UI imports so services can open dialogs.
 * `DialogHost` (Dialog.tsx) draws the dialog at the front of the queue.
 */
export type DialogItem = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

type DialogState = {
  /** Shown one at a time; a dialog opened from a button waits for the current one to close. */
  queue: DialogItem[];
  /** The dialog that just closed, kept so it stays drawn while the modal fades out. */
  last: DialogItem | null;
  push: (item: Omit<DialogItem, 'id'>) => void;
  shift: () => void;
  clear: () => void;
};

let nextId = 1;
export const useDialogStore = create<DialogState>((set) => ({
  queue: [],
  last: null,
  push: (item) => set((state) => ({ queue: [...state.queue, { ...item, id: nextId++ }] })),
  shift: () =>
    set((state) => ({ queue: state.queue.slice(1), last: state.queue[0] ?? state.last })),
  clear: () => set({ queue: [], last: null }),
}));

/**
 * In-app replacement for React Native's `Alert.alert`, with the same arguments, so dialogs
 * match the app's theme instead of the system style. Without a message and with several
 * choices it opens as a bottom sheet of options; otherwise as a centred dialog.
 */
export const dialog = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) =>
    useDialogStore.getState().push({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      options,
    }),
};
