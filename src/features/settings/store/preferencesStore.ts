import { create } from 'zustand';
import { secureStorage } from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

export type Preferences = {
  /** Show approximate distance on profiles (yours and others'). */
  showDistance: boolean;
  /** Share your online status. Reciprocal: when off you also don't see others'. */
  showActiveStatus: boolean;
  /** Send read receipts. Reciprocal: when off you also don't see others'. */
  readReceipts: boolean;
};

const defaults: Preferences = { showDistance: true, showActiveStatus: true, readReceipts: true };

type PreferencesState = Preferences & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...defaults,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await secureStorage.getPreferences();
      const stored = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
      set({ ...defaults, ...pick(stored), hydrated: true });
    } catch {
      set({ hydrated: true });
      logger.debug('Preferences could not be read; using defaults');
    }
  },
  set: (key, value) => {
    set({ [key]: value } as Pick<Preferences, typeof key>);
    const { showDistance, showActiveStatus, readReceipts } = get();
    // TODO(backend): also PATCH these to the server so they are enforced for other users.
    secureStorage
      .setPreferences(JSON.stringify({ showDistance, showActiveStatus, readReceipts }))
      .catch(() => logger.debug('Preferences could not be saved'));
  },
}));

function pick(value: Partial<Preferences>): Partial<Preferences> {
  const result: Partial<Preferences> = {};
  (Object.keys(defaults) as (keyof Preferences)[]).forEach((key) => {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  });
  return result;
}
