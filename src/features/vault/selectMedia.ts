import * as FS from 'expo-file-system/legacy';
import type { UploadAsset } from '@/features/feed/types';
import { assertSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';
import { assertEpoch, assertUnlocked } from './lock';
import { photoUri } from './media';
import { viewPhoto } from './vaultService';
import { removeTemp } from './files';
import { uuid } from './crypto';
import type { VaultPhoto } from './types';

export function validateVaultSelection(photos: VaultPhoto[]): void {
  if (!photos.length || photos.length > 5) throw new Error('Choose between one and five items.');
  if (photos.filter((photo) => photo.kind === 'video').length > 1)
    throw new Error('A post can include one video.');
  if (photos.some((photo) => photo.deletedAt))
    throw new Error('This item is no longer in your vault.');
}

/** Export only explicitly selected items into disposable draft copies. */
export async function selectVaultMedia(
  owner: string,
  photos: VaultPhoto[],
): Promise<UploadAsset[]> {
  validateVaultSelection(photos);
  const scope = assertUnlocked(owner);
  const session = sessionIdentity.generation;
  const valid = () => {
    assertSessionCurrent(session);
    if (sessionIdentity.userId !== owner) throw new Error('Sign in to select vault media.');
    assertEpoch(owner, scope);
  };
  const assets: UploadAsset[] = [];
  try {
    valid();
    if (!FS.cacheDirectory) throw new Error('Media storage is unavailable.');
    // Outside vault-temp: backgrounding locks the vault and clears viewing copies,
    // but an explicitly shared draft must remain available for posting/retry.
    const directory = `${FS.cacheDirectory}media-drafts/`;
    await FS.makeDirectoryAsync(directory, { intermediates: true });
    for (const photo of photos) {
      valid();
      await photoUri(owner, photo.id);
      valid();
      const temp = await viewPhoto(owner, photo.id);
      const video = photo.kind === 'video';
      const name = `${uuid()}.${video ? 'mp4' : 'jpg'}`;
      const asset: UploadAsset = {
        uri: `${directory}${name}`,
        name,
        type: video ? 'video/mp4' : 'image/jpeg',
        fromVault: true,
      };
      assets.push(asset);
      try {
        valid();
        await FS.copyAsync({ from: temp, to: asset.uri });
        valid();
      } finally {
        await removeTemp(temp);
      }
    }
    valid();
    return assets;
  } catch (error) {
    await Promise.all(
      assets.map((asset) => FS.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined)),
    );
    throw error;
  }
}
