import type { VaultPhoto } from './types';

// All photos includes earlier hidden-by-default imports, but only inside the unlocked vault.
// Hidden remains metadata; no user's existing preference is silently changed.
export function visiblePhotos(photos: VaultPhoto[], hiddenOnly: boolean): VaultPhoto[] {
  return photos.filter((photo) => !photo.deletedAt && (!hiddenOnly || Boolean(photo.hidden)));
}
export function vaultError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/cancel/i.test(message)) return '';
  if (/not enough storage/i.test(message))
    return 'Your phone is low on storage. Free some space and try again.';
  if (/permission/i.test(message))
    return 'Permission is needed for this action. You can enable it in phone settings.';
  if (/vault is full/i.test(message))
    return 'Your vault is full. Remove a photo before adding more.';
  if (/screen lock/i.test(message)) return 'Set up a screen lock on your phone to open your vault.';
  if (/Too many attempts/i.test(message)) return 'Please wait a minute before trying again.';
  return fallback;
}
