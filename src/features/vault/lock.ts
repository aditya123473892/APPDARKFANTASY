import { AppState } from 'react-native';
import { create } from 'zustand';
import * as LA from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { clearTemps } from './files';
import { newKey, passcodeHash, equalHash } from './crypto';
import { setting, setSetting } from './repository';

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
const credentialName = (owner: string) => `darkfantasy.vault.${owner}.passcode`;
export async function noDeviceLock(): Promise<boolean> {
  return (await LA.getEnrolledLevelAsync()) === LA.SecurityLevel.NONE;
}
async function waitForForeground(): Promise<void> {
  if (AppState.currentState === 'active') return;
  await new Promise<void>((resolve, reject) => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { clearTimeout(deadline); subscription.remove(); resolve(); }
    });
    const deadline = setTimeout(() => { subscription.remove(); reject(new Error('Unlock cancelled.')); }, 5000);
  });
}
export async function configurePasscode(owner: string, passcode: string): Promise<void> {
  if (!(await noDeviceLock())) throw new Error('Use your device screen lock.');
  if (await SecureStore.getItemAsync(credentialName(owner)))
    throw new Error('An app passcode is already configured.');
  if (!/^\d{6,12}$/.test(passcode)) throw new Error('Choose a passcode with 6–12 digits.');
  const salt = newKey();
  await SecureStore.setItemAsync(
    credentialName(owner),
    JSON.stringify({ salt, hash: await passcodeHash(passcode, salt) }),
  );
}
export async function unlock(owner: string, passcode?: string): Promise<void> {
  if (checking) throw new Error('Unlock is already in progress.');
  checking = true;
  const scope = epoch;
  try {
    const until = Number((await setting(owner, 'lockout')) || 0);
    if (Date.now() < until) throw new Error('Too many attempts. Try again after one minute.');
    let success = false;
    if (await noDeviceLock()) {
      const raw = await SecureStore.getItemAsync(credentialName(owner));
      if (!raw || !passcode)
        throw new Error('No device screen lock. Set up an app passcode to continue.');
      const credential = JSON.parse(raw) as { salt: string; hash: string };
      success = equalHash(credential.hash, await passcodeHash(passcode, credential.salt));
    } else {
      devicePrompt = true;
      let result: LA.LocalAuthenticationResult;
      try {
        result = await LA.authenticateAsync({
          promptMessage: 'Unlock Photo Vault', disableDeviceFallback: false, biometricsSecurityLevel: 'strong',
        });
        if (result.success) await waitForForeground();
      } finally { devicePrompt = false; }
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
      throw new Error('Could not unlock. Check your credentials.');
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
    // Android device-credential fallback opens Keyguard outside the activity.
    // Keep content locked while allowing that verified native prompt to resume.
    if (devicePrompt) { useVaultLock.setState({ unlocked: false }); return; }
    if (!timeoutMs) lock();
    else timer = setTimeout(lock, timeoutMs);
  }
});
