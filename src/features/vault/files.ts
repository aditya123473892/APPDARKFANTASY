import * as FS from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { uuid } from './crypto';
import { directory, close } from './repository';

const keyName = (owner: string) => `darkfantasy.vault.${owner}`;
export const tempDirectory = () => {
  if (!FS.cacheDirectory) throw new Error('Vault requires Android');
  return `${FS.cacheDirectory}vault-temp/`;
};
export async function read(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
export async function store(owner: string, id: string, bytes: Uint8Array): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid photo');
  if ((await FS.getFreeDiskStorageAsync()) < bytes.length * 3 + 10 * 1024 * 1024)
    throw new Error('Not enough storage for this photo.');
  const dir = directory(owner);
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}${id}.jpg`,
    partial = `${path}.partial`;
  // Ordinary JPEGs in private app storage; no additional image encryption.
  try {
    await new File(partial).write(bytes);
    await FS.moveAsync({ from: partial, to: path });
  } finally {
    await FS.deleteAsync(partial, { idempotent: true });
  }
  return path;
}
export async function clearTemps(): Promise<void> {
  await FS.deleteAsync(tempDirectory(), { idempotent: true });
}
export async function cleanupStartup(): Promise<void> {
  await clearTemps();
  if (!FS.cacheDirectory) return;
  for (const name of ['ImagePicker', 'ImageManipulator'])
    await FS.deleteAsync(`${FS.cacheDirectory}${name}/`, { idempotent: true });
}
export async function temporaryFile(bytes: Uint8Array): Promise<string> {
  const dir = tempDirectory();
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${uuid()}.jpg`;
  await new File(uri).write(bytes);
  return uri;
}
export async function removeTemp(uri: string): Promise<void> {
  if (!uri.startsWith(tempDirectory())) return;
  await FS.deleteAsync(uri, { idempotent: true });
}
export async function plaintext(owner: string, id: string, path: string): Promise<Uint8Array> {
  if (path !== `${directory(owner)}${id}.jpg`) throw new Error('Invalid vault path');
  return read(path);
}
/** The simpler vault already stores JPEGs privately. Display without a JS read/hash/copy. */
export async function localUri(owner: string, id: string, path: string): Promise<string> {
  if (path !== `${directory(owner)}${id}.jpg`) throw new Error('Invalid vault path');
  const info = await FS.getInfoAsync(path);
  if (!info.exists || info.isDirectory || !info.size) throw new Error('Photo unavailable');
  return path;
}
export async function wipe(owner: string): Promise<void> {
  // Clear encrypted-build credentials too, on explicit logout/wipe only.
  await SecureStore.deleteItemAsync(keyName(owner));
  await SecureStore.deleteItemAsync(`${keyName(owner)}.passcode`);
  await clearTemps();
  await close(owner);
  await FS.deleteAsync(directory(owner).replace(/simple\/$/, ''), { idempotent: true });
}
