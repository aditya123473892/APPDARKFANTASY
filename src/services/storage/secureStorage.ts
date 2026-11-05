import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'darkfantasy.token.v2';
const LEGACY_SESSION_KEY = 'nocturne.session.v1';
const PREFERENCES_KEY = 'darkfantasy.preferences.v1';
const AGE_CONFIRMED_KEY = 'darkfantasy.age-confirmed.v1';

export const secureStorage = {
  getSession: async (): Promise<string | null> => {
    await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
    return SecureStore.getItemAsync(SESSION_KEY);
  },
  setSession: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(SESSION_KEY, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clearSession: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(LEGACY_SESSION_KEY);
  },
  /** Non-sensitive UI preferences. Stored here because it is the only persistent store in the project. */
  getPreferences: async (): Promise<string | null> => SecureStore.getItemAsync(PREFERENCES_KEY),
  setPreferences: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(PREFERENCES_KEY, value),
  /** When this device's user confirmed they are 18 or older (ISO date), if ever. */
  getAgeConfirmedAt: async (): Promise<string | null> =>
    SecureStore.getItemAsync(AGE_CONFIRMED_KEY),
  setAgeConfirmedAt: async (value: string): Promise<void> =>
    SecureStore.setItemAsync(AGE_CONFIRMED_KEY, value),
};
