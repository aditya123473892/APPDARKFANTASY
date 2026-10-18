// Registered by the Android app; auth itself does not import native vault modules.
type VaultLifecycle = {
  logout: (discard: boolean) => Promise<void>;
  pause: () => void;
  signIn: (owner: string) => Promise<void>;
};
let lifecycle: VaultLifecycle | undefined;
export function registerLocalVaultLifecycle(value: VaultLifecycle): void {
  lifecycle = value;
}
export const prepareVaultLogout = (discard = false): Promise<void> =>
  lifecycle?.logout(discard) ?? Promise.resolve();
export const pauseLocalVault = (): void => lifecycle?.pause();
export const prepareVaultSignIn = (owner: string): Promise<void> =>
  lifecycle?.signIn(owner) ?? Promise.resolve();
