import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { requireOptionalNativeModule } from 'expo';

/** 4 to 12 digits; PINs set while 6 was the minimum still match. */
export const APP_PIN = /^\d{4,12}$/;
export type PinCredential = { salt: string; hash: string; iterations: number };
type PinKdf = {
  pbkdf2Sha256(
    password: string,
    saltHex: string,
    iterations: number,
    length: number,
  ): Promise<string>;
};
/**
 * Native PBKDF2 (modules/pin-kdf): 600,000 rounds take tens of seconds in JavaScript on
 * Hermes but about a second natively, off the JS thread. Missing on web, in tests and in
 * builds made before the module existed; the JavaScript version gives the same result.
 */
const nativeKdf = requireOptionalNativeModule<PinKdf>('PinKdf');
const derive = async (pin: string, salt: Uint8Array, iterations: number) => {
  if (nativeKdf) {
    try {
      return hexToBytes(await nativeKdf.pbkdf2Sha256(pin, bytesToHex(salt), iterations, 32));
    } catch {
      // Fall through to the JavaScript derivation.
    }
  }
  return pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
};
export async function createCredential(pin: string, salt: Uint8Array): Promise<PinCredential> {
  if (!APP_PIN.test(pin) || salt.length !== 32) throw new Error('Use a PIN of 4 to 12 digits.');
  return {
    salt: bytesToHex(salt),
    iterations: 600_000,
    hash: bytesToHex(await derive(pin, salt, 600_000)),
  };
}
export async function checkCredential(pin: string, record: PinCredential): Promise<boolean> {
  if (!APP_PIN.test(pin)) return false;
  if (
    record.iterations !== 600_000 ||
    !/^[a-f\d]{64}$/.test(record.salt) ||
    !/^[a-f\d]{64}$/.test(record.hash)
  )
    throw new Error('App Lock credentials are unavailable. Sign in again to reset.');
  const actual = await derive(pin, hexToBytes(record.salt), record.iterations);
  const expected = hexToBytes(record.hash);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i]! ^ expected[i]!;
  actual.fill(0);
  return difference === 0;
}
export function lockExpired(backgroundAt: number | null, timeout: number, now = Date.now()) {
  return backgroundAt !== null && (now < backgroundAt || now - backgroundAt >= timeout);
}
