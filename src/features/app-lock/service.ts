import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { checkCredential, createCredential, type PinCredential } from './credentials';
import { whileExternal } from '@/services/externalActivity';

export const LOCK_TIMEOUTS = [0, 30_000, 60_000, 300_000] as const;
export type LockConfig = {
  version: 1;
  pin: PinCredential;
  biometric: boolean;
  biometricHash?: string;
  timeout: number;
  attempts: number;
  retryAt: number;
};
const name = (owner: string) => {
  if (!/^[a-f\d]{24}$/i.test(owner)) throw new Error('Invalid account');
  return 'darkfantasy.app-lock.' + owner;
};
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export async function readAppLock(owner: string): Promise<LockConfig | null> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const raw = await Promise.race([
    SecureStore.getItemAsync(name(owner)),
    new Promise<never>((_, reject) => {
      deadline = setTimeout(
        () => reject(new Error('App Lock storage timed out. Retry or verify your account.')),
        10_000,
      );
    }),
  ]).finally(() => clearTimeout(deadline));
  if (!raw) return null;
  const value: LockConfig = JSON.parse(raw);
  if (
    value.version !== 1 ||
    !LOCK_TIMEOUTS.includes(value.timeout as (typeof LOCK_TIMEOUTS)[number]) ||
    !value.pin ||
    typeof value.biometric !== 'boolean' ||
    !Number.isFinite(value.attempts) ||
    !Number.isFinite(value.retryAt)
  )
    throw new Error('App Lock unavailable. Sign in again to reset.');
  return value;
}
async function write(owner: string, value: LockConfig) {
  await SecureStore.setItemAsync(name(owner), JSON.stringify(value), options);
}
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => undefined);
  return result;
}
async function verified(owner: string, pin: string): Promise<LockConfig> {
  const config = await readAppLock(owner);
  if (!config) throw new Error('Set a PIN first.');
  if (config.retryAt > Date.now()) throw new Error('Too many attempts. Try again in a minute.');
  if (!(await checkCredential(pin, config.pin))) {
    const attempts = config.attempts + 1;
    await write(owner, { ...config, attempts, retryAt: attempts >= 5 ? Date.now() + 60_000 : 0 });
    throw new Error('Incorrect PIN.');
  }
  const next = { ...config, attempts: 0, retryAt: 0 };
  await write(owner, next);
  return next;
}
export function verifyAppPin(owner: string, pin: string) {
  return serial(() => verified(owner, pin));
}
export function setAppPin(owner: string, pin: string, previous?: string | null, biometric = false) {
  return serial(async () => {
    const config = await readAppLock(owner);
    if (config) {
      if (previous === null) await verifiedBiometric(owner);
      else await verified(owner, previous ?? '');
    }
    const next: LockConfig = {
      version: 1,
      pin: await createCredential(pin, getRandomBytes(32)),
      biometric: config?.biometric ?? false,
      ...(config?.biometricHash ? { biometricHash: config.biometricHash } : {}),
      timeout: config?.timeout ?? 0,
      attempts: 0,
      retryAt: 0,
    };
    // Setup is a single flow: one PIN derivation and one native enrollment prompt.
    if (biometric && !next.biometric) await enrollBiometrics(owner, next);
    await write(owner, next);
    return next;
  });
}
export async function biometricAvailability(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) &&
    (await LocalAuthentication.isEnrolledAsync()) &&
    SecureStore.canUseBiometricAuthentication()
  );
}
async function enrollBiometrics(owner: string, next: LockConfig): Promise<void> {
  if (!(await biometricAvailability()))
    throw new Error('Set up fingerprint or Face ID in your phone settings, or use an app PIN.');
  const secret = getRandomBytes(32);
  try {
    await whileExternal(async () => {
      if (Platform.OS !== 'android') {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable biometric unlock',
          disableDeviceFallback: true,
          biometricsSecurityLevel: 'strong',
        });
        if (!result.success) throw new Error('Biometric authentication cancelled.');
      }
      await SecureStore.setItemAsync(name(owner) + '.biometric', bytesToHex(secret), {
        ...options,
        requireAuthentication: true,
        authenticationPrompt: 'Enable biometric unlock',
      });
    });
    next.biometricHash = bytesToHex(sha256(secret));
    next.biometric = true;
  } catch {
    throw new Error('Biometric setup cancelled. Try again or choose PIN only.');
  } finally {
    secret.fill(0);
  }
}
export function changeLockSettings(
  owner: string,
  pin: string | null,
  change: { biometric?: boolean; timeout?: number; disable?: boolean },
) {
  return serial(async () => {
    const config = pin === null ? await verifiedBiometric(owner) : await verified(owner, pin);
    if (change.disable) {
      await SecureStore.deleteItemAsync(name(owner));
      await SecureStore.deleteItemAsync(name(owner) + '.biometric');
      return null;
    }
    const next = { ...config };
    if (change.timeout !== undefined) {
      if (!LOCK_TIMEOUTS.includes(change.timeout as (typeof LOCK_TIMEOUTS)[number]))
        throw new Error('Invalid timeout');
      next.timeout = change.timeout;
    }
    if (change.biometric === true) {
      if (!next.biometric) await enrollBiometrics(owner, next);
    } else if (change.biometric === false) {
      next.biometric = false;
      delete next.biometricHash;
      await SecureStore.deleteItemAsync(name(owner) + '.biometric');
    }
    await write(owner, next);
    return next;
  });
}
async function verifiedBiometric(owner: string): Promise<LockConfig> {
  const config = await readAppLock(owner);
  if (!config?.biometric || !(await LocalAuthentication.isEnrolledAsync()))
    throw new Error('Use your app PIN.');
  // The keychain/keystore prompt is the proof: the secret is only released after it.
  // A separate authenticateAsync first made every unlock ask twice.
  let secret: string | null;
  try {
    secret = await whileExternal(() =>
      SecureStore.getItemAsync(name(owner) + '.biometric', {
        requireAuthentication: true,
        authenticationPrompt: 'Unlock DARKFANTASY',
      }),
    );
  } catch {
    throw new Error('Use your app PIN.');
  }
  if (!secret || bytesToHex(sha256(hexToBytes(secret))) !== config.biometricHash)
    throw new Error('Biometrics changed. Unlock with your PIN and enable biometrics again.');
  return config;
}
export function biometricUnlock(owner: string) {
  return serial(() => verifiedBiometric(owner));
}
