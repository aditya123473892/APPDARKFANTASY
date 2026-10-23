import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { uuid as expoUuid } from 'expo';

// Hashing is JavaScript-only. UUID support comes from Expo's existing core runtime,
// so older installed development APKs do not need a new ExpoCrypto native module.
// These helpers identify/verify files; they do not encrypt images.
export const uuid = (): string => expoUuid.v4();
export async function hash(bytes: Uint8Array): Promise<string> {
  return bytesToHex(sha256(bytes));
}
