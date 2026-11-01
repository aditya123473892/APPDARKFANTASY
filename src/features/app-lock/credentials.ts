import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

export const APP_PIN = /^\d{6,12}$/;
export type PinCredential = { salt: string; hash: string; iterations: number };
const derive = (pin: string, salt: Uint8Array, iterations: number) =>
  pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
export async function createCredential(pin: string, salt: Uint8Array): Promise<PinCredential> {
  if (!APP_PIN.test(pin) || salt.length !== 32) throw new Error('Use a PIN of 6 to 12 digits.');
  return { salt: bytesToHex(salt), iterations: 600_000,
    hash: bytesToHex(await derive(pin, salt, 600_000)) };
}
export async function checkCredential(pin: string, record: PinCredential): Promise<boolean> {
  if (!APP_PIN.test(pin)) return false;
  if (record.iterations !== 600_000 || !/^[a-f\d]{64}$/.test(record.salt) || !/^[a-f\d]{64}$/.test(record.hash))
    throw new Error('App Lock credentials are unavailable. Sign in again to reset.');
  const actual = await derive(pin, hexToBytes(record.salt), record.iterations);
  const expected = hexToBytes(record.hash);
  let difference = 0;
  for (let i=0; i<actual.length; i++) difference |= actual[i]! ^ expected[i]!;
  actual.fill(0);
  return difference === 0;
}
export function lockExpired(backgroundAt: number | null, timeout: number, now = Date.now()) {
  return backgroundAt !== null && (now < backgroundAt || now - backgroundAt >= timeout);
}
