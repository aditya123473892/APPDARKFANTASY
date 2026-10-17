// TEMPORARY dev-only web fallback for taking screenshots in the browser.
// expo-secure-store has no web implementation, so web login cannot persist a session.
// Revert: delete this file. Native builds never load it (Metro picks .web.ts on web only).
const SESSION_KEY = 'darkfantasy.token.v2';
const PREFERENCES_KEY = 'darkfantasy.preferences.v1';

function store(): Storage {
  if (!__DEV__) throw new Error('Web session storage is development-only');
  return window.sessionStorage;
}

export const secureStorage = {
  getSession: async (): Promise<string | null> => store().getItem(SESSION_KEY),
  setSession: async (value: string): Promise<void> => store().setItem(SESSION_KEY, value),
  clearSession: async (): Promise<void> => store().removeItem(SESSION_KEY),
  getPreferences: async (): Promise<string | null> => store().getItem(PREFERENCES_KEY),
  setPreferences: async (value: string): Promise<void> => store().setItem(PREFERENCES_KEY, value),
};
