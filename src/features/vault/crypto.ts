import * as Crypto from 'expo-crypto';

// Expo Go supplies this module. These identify/verify files; they do not encrypt them.
export const uuid = (): string => Crypto.randomUUID();
export async function hash(bytes: Uint8Array): Promise<string> {
  const result = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
