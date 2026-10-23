import { AppState } from 'react-native';
import { create } from 'zustand';
import * as LA from 'expo-local-authentication';
import { clearTemps } from './files';
import { setting, setSetting } from './repository';
import {
  cancelPinPrompt,
  clearPin,
  hasPin,
  requestPin,
  savePin,
  verifyPin,
  type UnlockMethod,
} from './pin';

export const useVaultLock = create<{ owner: string | null; unlocked: boolean; revision: number }>(
  () => ({ owner: null, unlocked: false, revision: 0 }),
);
let epoch = 0;
let checking = false;
let devicePrompt = false;
let timeoutMs = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
export function refreshVault(): void {
  useVaultLock.setState((s) => ({ revision: s.revision + 1 }));
}
export function lock(): void {
  epoch++;
  cancelPinPrompt();
  useVaultLock.setState({ unlocked: false });
  void clearTemps().catch(() => undefined);
}
export function assertUnlocked(owner: string): number {
  const s = useVaultLock.getState();
  if (!s.unlocked || s.owner !== owner || AppState.currentState !== 'active')
    throw new Error('Unlock your vault first.');
  return epoch;
}
export function assertEpoch(owner: string, scope: number): void {
  assertUnlocked(owner);
  if (scope !== epoch) throw new Error('Vault locked');
}
export async function noDeviceLock(): Promise<boolean> {
  return (await LA.getEnrolledLevelAsync()) === LA.SecurityLevel.NONE;
}
/** The user's choice: device biometrics (with screen-lock fallback) or a vault PIN. */
export async function unlockMethod(owner: string): Promise<UnlockMethod> {
  return (await setting(owner, 'unlockMethod')) === 'pin' && (await hasPin(owner))
    ? 'pin'
    : 'device';
}
/** Changing the method requires an open vault; a PIN is (re)saved when chosen. */
export async function setUnlockMethod(
  owner: string,
  method: UnlockMethod,
  pin?: string,
): Promise<void> {
  assertUnlocked(owner);
  if (method === 'pin') {
    await savePin(owner, pin ?? '');
    await setSetting(owner, 'unlockMethod', 'pin');
    return;
  }
  if (await noDeviceLock()) throw new Error('Set up an Android screen lock to use biometrics.');
  await setSetting(owner, 'unlockMethod', 'device');
  await clearPin(owner);
}
export async function waitForForeground(): Promise<void> {
  if (AppState.currentState === 'active') return;
  await new Promise<void>((resolve, reject) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTimeout(deadline);
        subscription.remove();
        resolve();
      }
    });
    const deadline = setTimeout(() => {
      subscription.remove();
      reject(new Error('Unlock cancelled.'));
    }, 5000);
  });
}
export async function unlock(owner: string): Promise<void> {
  if (checking) throw new Error('Unlock is already in progress.');
  checking = true;
  const scope = epoch;
  try {
    const until = Number((await setting(owner, 'lockout')) || 0);
    if (Date.now() < until) throw new Error('Too many attempts. Try again after one minute.');
    let success = false;
    const method = await unlockMethod(owner);
    if (method === 'pin') {
      const failures = Number((await setting(owner, 'attempts')) || 0);
      const pin = await requestPin(failures ? 'Incorrect PIN. Try again.' : '');
      success = await verifyPin(owner, pin);
    } else {
      if (await noDeviceLock())
        throw new Error('Set up an Android screen lock to use Photo Vault.');
      devicePrompt = true;
      let result: LA.LocalAuthenticationResult;
      try {
        result = await LA.authenticateAsync({
          promptMessage: 'Unlock Photo Vault',
          disableDeviceFallback: false,
          biometricsSecurityLevel: 'strong',
        });
        if (result.success) await waitForForeground();
      } finally {
        devicePrompt = false;
      }
      success = result.success;
      if (!result.success && ['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error))
        throw new Error('Unlock cancelled.');
    }
    if (!success) {
      const count = Number((await setting(owner, 'attempts')) || 0) + 1;
      await setSetting(owner, 'attempts', String(count));
      if (count >= 5) {
        await setSetting(owner, 'lockout', String(Date.now() + 60_000));
        await setSetting(owner, 'attempts', '0');
        lock();
      }
      throw new Error(
        method === 'pin' ? 'Incorrect PIN.' : 'Could not unlock. Check your credentials.',
      );
    }
    if (scope !== epoch || AppState.currentState !== 'active') throw new Error('Unlock cancelled.');
    await setSetting(owner, 'attempts', '0');
    await setSetting(owner, 'lockout', '0');
    timeoutMs = Math.min(300_000, Math.max(0, Number((await setting(owner, 'timeout')) || 0)));
    if (scope !== epoch || AppState.currentState !== 'active') throw new Error('Unlock cancelled.');
    clearTimeout(timer);
    useVaultLock.setState({ owner, unlocked: true });
  } finally {
    checking = false;
  }
}
export async function setLockTimeout(owner: string, milliseconds: number): Promise<void> {
  assertUnlocked(owner);
  timeoutMs = Math.min(300_000, Math.max(0, milliseconds));
  await setSetting(owner, 'timeout', String(timeoutMs));
}
AppState.addEventListener('change', (state) => {
  clearTimeout(timer);
  if (state !== 'active') {
    void clearTemps().catch(() => undefined);
    cancelPinPrompt();
    // Android device-credential fallback opens Keyguard outside the activity.
    // Keep content locked while allowing that verified native prompt to resume.
    if (devicePrompt) {
      useVaultLock.setState({ unlocked: false });
      return;
    }
    if (!timeoutMs) lock();
    else timer = setTimeout(lock, timeoutMs);
  }
});
