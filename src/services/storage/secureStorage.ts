import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'nocturne.session.v1';

export const secureStorage = {
  getSession: async (): Promise<string | null> => SecureStore.getItemAsync(SESSION_KEY),
  setSession: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(SESSION_KEY, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  clearSession: async (): Promise<void> => SecureStore.deleteItemAsync(SESSION_KEY),
};
