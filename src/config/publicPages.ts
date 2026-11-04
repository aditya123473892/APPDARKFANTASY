import Constants from 'expo-constants';

export type PublicPage = 'privacy' | 'terms' | 'support' | 'deletion';
export function publicPageUrl(page: PublicPage): string | undefined {
  const value = Constants.expoConfig?.extra?.publicPages?.[page];
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
