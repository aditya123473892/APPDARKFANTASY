import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { uuid } from './crypto';

export type UnlockMethod = 'device' | 'pin';
export const PIN_PATTERN = /^\d{4,8}$/;
const ITERATIONS = 60_000;
// Same SecureStore name the vault wipe already clears on explicit logout.
const pinKey = (owner: string) => `darkfantasy.vault.${owner}.passcode`;

type StoredPin = { v: 1; salt: string; hash: string; c: number };
async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
}
/** Two v4 UUIDs from Expo's native random source give a 32-byte salt. */
function salt(): Uint8Array {
  return hexToBytes(`${uuid()}${uuid()}`.replace(/-/g, ''));
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
export async function hasPin(owner: string): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(pinKey(owner)));
}
export async function savePin(owner: string, pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new Error('Use a PIN of 4 to 8 digits.');
  const value = salt();
  const stored: StoredPin = {
    v: 1,
    salt: bytesToHex(value),
    hash: bytesToHex(await derive(pin, value, ITERATIONS)),
    c: ITERATIONS,
  };
  await SecureStore.setItemAsync(pinKey(owner), JSON.stringify(stored));
}
export async function verifyPin(owner: string, pin: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(pinKey(owner));
  if (!raw || !PIN_PATTERN.test(pin)) return false;
  const stored = JSON.parse(raw) as StoredPin;
  return equal(await derive(pin, hexToBytes(stored.salt), stored.c), hexToBytes(stored.hash));
}
export async function clearPin(owner: string): Promise<void> {
  await SecureStore.deleteItemAsync(pinKey(owner));
}

/**
 * `unlock()` can be called from any screen (including post uploads), so the
 * PIN entry is a global prompt: the caller awaits a PIN, the mounted
 * VaultPinPrompt resolves it, or rejects it as a cancellation.
 */
type Prompt = { resolve: (pin: string) => void; reject: (error: Error) => void };
export const usePinPrompt = create<{ prompt: Prompt | null; error: string }>(() => ({
  prompt: null,
  error: '',
}));
export function requestPin(error = ''): Promise<string> {
  usePinPrompt.getState().prompt?.reject(new Error('Unlock cancelled.'));
  return new Promise<string>((resolve, reject) => {
    const finish = () => usePinPrompt.setState({ prompt: null, error: '' });
    usePinPrompt.setState({
      error,
      prompt: {
        resolve: (pin) => {
          finish();
          resolve(pin);
        },
        reject: (cause) => {
          finish();
          reject(cause);
        },
      },
    });
  });
}
export function cancelPinPrompt(): void {
  usePinPrompt.getState().prompt?.reject(new Error('Unlock cancelled.'));
}
