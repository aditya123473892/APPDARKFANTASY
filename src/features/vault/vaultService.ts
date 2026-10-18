import * as FS from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { sessionIdentity, assertSessionCurrent } from '@/features/auth/sessionRuntime';
import * as repo from './repository';
import * as files from './files';
import { hash, uuid } from './crypto';
import { assertUnlocked, assertEpoch, lock, refreshVault, unlock, useVaultLock } from './lock';
import type { VaultPhoto } from './types';
import { requestUnlock } from './components/VaultPasscodePrompt';

const OWNER_KEY = 'darkfantasy.vault.owner';
let tail: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(fn, fn);
  tail = next.catch(() => undefined);
  return next;
}
export const localOwner = () => SecureStore.getItemAsync(OWNER_KEY);
export async function rememberOwner(owner: string): Promise<void> {
  repo.directory(owner);
  await SecureStore.setItemAsync(OWNER_KEY, owner);
}
export async function importPhoto(owner: string, uri: string): Promise<VaultPhoto> {
  const scope = assertUnlocked(owner);
  let cleanUri: string | undefined;
  try {
    const context = ImageManipulator.manipulate(uri);
    const image = await context.renderAsync();
    if (image.width > 1080 || image.height > 1920) {
      const ratio = Math.min(1080 / image.width, 1920 / image.height, 1);
      context.resize({
        width: Math.round(image.width * ratio),
        height: Math.round(image.height * ratio),
      });
    }
    const rendered = await context.renderAsync();
    const clean = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    cleanUri = clean.uri;
    const bytes = await files.read(clean.uri);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
    return await serial(async () => {
      assertEpoch(owner, scope);
      if ((await repo.list(owner)).length >= 50) throw new Error('Your vault is full (50 photos).');
      const id = uuid(),
        now = Date.now();
      const path = await files.store(owner, id, bytes);
      try {
        assertEpoch(owner, scope);
        const photo: VaultPhoto = {
          id,
          s3Key: null,
          localPath: path,
          sha256: hash(bytes),
          size: bytes.length,
          status: 'local',
          hidden: 1,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncState: 'pending_upload',
          error: null,
        };
        await repo.save(owner, photo, 'upload');
        await rememberOwner(owner);
        refreshVault();
        return photo;
      } catch (error) {
        await FS.deleteAsync(path, { idempotent: true });
        throw error;
      } finally {
        bytes.fill(0);
      }
    });
  } finally {
    for (const path of [cleanUri, uri])
      if (path && FS.cacheDirectory && path.startsWith(FS.cacheDirectory))
        await FS.deleteAsync(path, { idempotent: true }).catch(() => undefined);
  }
}
export async function addPhotos(owner: string, camera = false, passcode?: string): Promise<void> {
  assertUnlocked(owner);
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error('Camera permission was denied. You can enable it in Settings.');
  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        exif: false,
        base64: false,
        quality: 1,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        exif: false,
        base64: false,
        quality: 1,
      });
  if (result.canceled) return;
  // Picker/camera can background the app; keep the vault locked until re-authenticated.
  try {
    if (!useVaultLock.getState().unlocked) {
      if (passcode) await unlock(owner, passcode);
      else await requestUnlock(owner);
    }
    for (const asset of result.assets) await importPhoto(owner, asset.uri);
  } finally {
    for (const asset of result.assets)
      if (FS.cacheDirectory && asset.uri.startsWith(FS.cacheDirectory))
        await FS.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined);
  }
}
export async function editPhoto(
  owner: string,
  id: string,
  change: { hidden?: number; sortOrder?: number; deletedAt?: number },
): Promise<void> {
  const scope = assertUnlocked(owner);
  await serial(async () => {
    assertEpoch(owner, scope);
    const photo = await repo.get(owner, id);
    if (!photo || photo.deletedAt) return;
    const deleted = Boolean(change.deletedAt);
    const updated = {
      ...photo,
      ...change,
      updatedAt: Math.max(Date.now(), photo.updatedAt + 1),
      syncState: deleted
        ? ('pending' as const)
        : photo.syncState === 'pending_upload'
          ? ('pending_upload' as const)
          : ('pending' as const),
    };
    await repo.save(owner, updated, deleted ? 'delete' : photo.s3Key ? 'patch' : undefined);
    if (deleted && photo.localPath) await FS.deleteAsync(photo.localPath, { idempotent: true });
    refreshVault();
  });
}
export async function viewPhoto(owner: string, id: string): Promise<string> {
  const scope = assertUnlocked(owner);
  const photo = await repo.get(owner, id);
  if (!photo || photo.deletedAt || !photo.localPath)
    throw new Error('Download this photo before viewing.');
  const bytes = await files.plaintext(owner, id, photo.localPath);
  try {
    assertEpoch(owner, scope);
    const uri = await files.temporaryFile(bytes);
    try {
      assertEpoch(owner, scope);
      return uri;
    } catch (error) {
      await files.removeTemp(uri);
      throw error;
    }
  } finally {
    bytes.fill(0);
  }
}
export async function wipeVault(): Promise<void> {
  const owner = await localOwner();
  lock();
  await serial(async () => {
    if (owner) await files.wipe(owner);
    await SecureStore.deleteItemAsync(OWNER_KEY);
  });
}
export async function hasUnsyncedPhotos(): Promise<boolean> {
  const owner = await localOwner();
  return owner ? (await repo.unsynced(owner)) > 0 : false;
}
export async function initializeVaultOwner(): Promise<string> {
  const owner = sessionIdentity.userId ?? (await localOwner());
  if (!owner) throw new Error('Sign in online once before using Photo Vault.');
  if (sessionIdentity.userId) {
    assertSessionCurrent(sessionIdentity.generation);
    await rememberOwner(owner);
  }
  return owner;
}

/** Publish a separate approved copy; vault keys never attach to public resources. */
export async function publishPhoto(
  asset: { uri: string; type: string; name: string },
  transport: (prepared: { uri: string; type: string; name: string }) => Promise<string>,
): Promise<string> {
  const owner = sessionIdentity.userId;
  if (!owner) throw new Error('Sign in before publishing a photo.');
  const session = sessionIdentity.generation;
  if (!useVaultLock.getState().unlocked || useVaultLock.getState().owner !== owner)
    await requestUnlock(owner);
  const photo = await importPhoto(owner, asset.uri);
  let temp: string | undefined;
  try {
    assertSessionCurrent(session);
    temp = await viewPhoto(owner, photo.id);
    return await transport({ ...asset, uri: temp, type: 'image/jpeg', name: 'photo.jpg' });
  } finally {
    if (temp) await files.removeTemp(temp);
  }
}
