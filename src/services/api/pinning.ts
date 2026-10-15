import { env } from '@/config/env';
let initialization: Promise<void> | undefined;
export async function initializePinning(): Promise<void> {
  if (__DEV__ || !env.pinningEnabled) return;
  initialization ??= (async () => {
    const { initializeSslPinning, isSslPinningAvailable } =
      await import('react-native-ssl-public-key-pinning');
    if (!isSslPinningAvailable()) throw new Error('Certificate pinning is unavailable');
    await initializeSslPinning({
      [new URL(env.apiUrl).hostname]: {
        includeSubdomains: false,
        publicKeyHashes: env.pins,
      },
    });
  })();
  await initialization;
}
