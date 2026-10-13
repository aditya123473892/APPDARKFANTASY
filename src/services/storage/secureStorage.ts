import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'nocturne.session.v1';
const PREFERENCES_KEY = 'darkfantasy.preferences.v1';

export const secureStorage = {
  getSession: async (): Promise<string | null> => SecureStore.getItemAsync(SESSION_KEY),
  setSession: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(SESSION_KEY, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  clearSession: async (): Promise<void> => SecureStore.deleteItemAsync(SESSION_KEY),
  /** Non-sensitive UI preferences. Stored here because it is the only persistent store in the project. */
  getPreferences: async (): Promise<string | null> => SecureStore.getItemAsync(PREFERENCES_KEY),
  setPreferences: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(PREFERENCES_KEY, value),
};
