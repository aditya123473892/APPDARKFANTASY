import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { checkCredential, createCredential, type PinCredential } from './credentials';

export const LOCK_TIMEOUTS = [0, 30_000, 60_000, 300_000] as const;
export type LockConfig = { version: 1; pin: PinCredential; biometric: boolean; biometricHash?: string;
  timeout: number; attempts: number; retryAt: number };
const name = (owner: string) => {
  if (!/^[a-f\d]{24}$/i.test(owner)) throw new Error('Invalid account');
  return 'darkfantasy.app-lock.' + owner;
};
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export async function readAppLock(owner: string): Promise<LockConfig | null> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const raw = await Promise.race([
    SecureStore.getItemAsync(name(owner)),
    new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('App Lock storage timed out. Retry or verify your account.')), 10_000); }),
  ]).finally(() => clearTimeout(deadline));
  if (!raw) return null;
  const value: LockConfig = JSON.parse(raw);
  if (value.version !== 1 || !LOCK_TIMEOUTS.includes(value.timeout as typeof LOCK_TIMEOUTS[number]) ||
    !value.pin || typeof value.biometric !== 'boolean' || !Number.isFinite(value.attempts) ||
    !Number.isFinite(value.retryAt)) throw new Error('App Lock unavailable. Sign in again to reset.');
  return value;
}
async function write(owner: string, value: LockConfig) {
  await SecureStore.setItemAsync(name(owner), JSON.stringify(value), options);
}
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn); queue = result.catch(() => undefined); return result;
}
async function verified(owner: string, pin: string): Promise<LockConfig> {
  const config = await readAppLock(owner);
  if (!config) throw new Error('Set a PIN first.');
  if (config.retryAt > Date.now()) throw new Error('Too many attempts. Try again in a minute.');
  if (!await checkCredential(pin, config.pin)) {
    const attempts = config.attempts + 1;
    await write(owner, { ...config, attempts, retryAt: attempts >= 5 ? Date.now()+60_000 : 0 });
    throw new Error('Incorrect PIN.');
  }
  const next = { ...config, attempts: 0, retryAt: 0 };
  await write(owner, next);
  return next;
}
export function verifyAppPin(owner: string, pin: string) {
  return serial(() => verified(owner, pin));
}
export function setAppPin(owner: string, pin: string, previous?: string) {
  return serial(async () => {
    const config = await readAppLock(owner);
    if (config) await verified(owner, previous ?? '');
    const next: LockConfig = { version: 1, pin: await createCredential(pin, getRandomBytes(32)),
      biometric: false, timeout: config?.timeout ?? 0, attempts: 0, retryAt: 0 };
    await write(owner, next);
    await SecureStore.deleteItemAsync(name(owner)+'.biometric');
    return next;
  });
}
export function changeLockSettings(owner: string, pin: string, change: { biometric?: boolean; timeout?: number; disable?: boolean }) {
  return serial(async () => {
    const config = await verified(owner, pin);
    if (change.disable) {
      await SecureStore.deleteItemAsync(name(owner));
      await SecureStore.deleteItemAsync(name(owner)+'.biometric'); return null;
    }
    const next = { ...config };
    if (change.timeout !== undefined) {
      if (!LOCK_TIMEOUTS.includes(change.timeout as typeof LOCK_TIMEOUTS[number])) throw new Error('Invalid timeout');
      next.timeout = change.timeout;
    }
    if (change.biometric === true) {
      if (!await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync() || !SecureStore.canUseBiometricAuthentication())
        throw new Error('Biometric unlock is unavailable. Your PIN still works.');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable biometric unlock',
        disableDeviceFallback: true, biometricsSecurityLevel: 'strong' });
      if (!result.success) throw new Error('Biometric authentication cancelled.');
      const secret = getRandomBytes(32);
      await SecureStore.setItemAsync(name(owner)+'.biometric', bytesToHex(secret), { ...options, requireAuthentication: true });
      next.biometricHash = bytesToHex(sha256(secret)); secret.fill(0); next.biometric = true;
    } else if (change.biometric === false) {
      next.biometric = false; delete next.biometricHash;
      await SecureStore.deleteItemAsync(name(owner)+'.biometric');
    }
    await write(owner, next); return next;
  });
}
export function biometricUnlock(owner: string) {
  return serial(async () => {
    const config = await readAppLock(owner);
    if (!config?.biometric || !await LocalAuthentication.isEnrolledAsync()) throw new Error('Use your app PIN.');
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock DARKFANTASY',
      disableDeviceFallback: true, biometricsSecurityLevel: 'strong' });
    if (!result.success) throw new Error('Use your app PIN.');
    const secret = await SecureStore.getItemAsync(name(owner)+'.biometric', { requireAuthentication: true });
    if (!secret || bytesToHex(sha256(hexToBytes(secret))) !== config.biometricHash)
      throw new Error('Biometrics changed. Unlock with your PIN and enable biometrics again.');
    return config;
  });
}
