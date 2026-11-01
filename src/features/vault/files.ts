import * as FS from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { encryptPhoto, decryptPhoto, encryptedPhoto, photoKeyName } from './photoEncryption';
import { hash, uuid } from './crypto';
import { directory, close, database } from './repository';

const keyName = (owner: string) => `darkfantasy.vault.${owner}`;
export const tempDirectory = () => {
  if (!FS.cacheDirectory) throw new Error('Vault requires Android');
  return `${FS.cacheDirectory}vault-temp/`;
};
/** Videos are capped well below phone storage; the server enforces its own limit. */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const validPath = (owner: string, id: string, path: string) =>
  path === `${directory(owner)}${id}.jpg` || path === `${directory(owner)}${id}.mp4`;
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
  const sealed = await encryptPhoto(owner, id, bytes);
  try {
    await new File(partial).write(sealed);
    // Authenticate and compare the actual on-disk bytes before committing the new copy.
    const verified = await decryptPhoto(owner, id, await read(partial));
    try { if (await hash(verified) !== await hash(bytes)) throw new Error('Encrypted photo verification failed'); }
    finally { verified.fill(0); }
    await FS.moveAsync({ from: partial, to: path });
  } finally {
    await FS.deleteAsync(partial, { idempotent: true });
  }
  return path;
}
/**
 * Move a finished video file into private vault storage without reading it
 * into JavaScript. Returns its size and native MD5 for sync verification.
 */
export async function storeVideo(
  owner: string,
  id: string,
  source: string,
  move = false,
): Promise<{ path: string; size: number; md5: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid video');
  const info = await FS.getInfoAsync(source, { md5: true });
  if (!info.exists || info.isDirectory || !info.size || !info.md5)
    throw new Error('Video unavailable');
  if (info.size > VIDEO_MAX_BYTES) throw new Error('Choose a video smaller than 50 MB.');
  if ((await FS.getFreeDiskStorageAsync()) < info.size * 2 + 20 * 1024 * 1024)
    throw new Error('Not enough storage for this video.');
  const dir = directory(owner);
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const path = `${dir}${id}.mp4`,
    partial = `${path}.partial`;
  try {
    if (move) await FS.moveAsync({ from: source, to: partial });
    else await FS.copyAsync({ from: source, to: partial });
    await FS.moveAsync({ from: partial, to: path });
  } finally {
    await FS.deleteAsync(partial, { idempotent: true });
  }
  return { path, size: info.size, md5: info.md5.toLowerCase() };
}
/** A share/export copy that leaves the private vault file untouched. */
export async function temporaryCopy(path: string, extension: 'jpg' | 'mp4'): Promise<string> {
  const dir = tempDirectory();
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${uuid()}.${extension}`;
  await FS.copyAsync({ from: path, to: uri });
  return uri;
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
  const bytes = await read(path);
  if (encryptedPhoto(bytes)) return decryptPhoto(owner, id, bytes);
  // Upgrade existing ordinary JPEGs atomically. Never discard the old file before verification.
  await store(owner, id, bytes);
  await markEncrypted(owner, id, path);
  return bytes;
}
export async function verifyLocalPhoto(owner: string, photo: { id: string; localPath: string | null; sha256: string; size: number }) {
  if (!photo.localPath) return false;
  try {
    const bytes = await plaintext(owner, photo.id, photo.localPath);
    try { return bytes.length === photo.size && await hash(bytes) === photo.sha256; }
    finally { bytes.fill(0); }
  } catch { return false; }
}
async function markEncrypted(owner: string, id: string, path: string) {
  await (await database(owner)).runAsync('UPDATE photos SET localEncrypted=1 WHERE id=? AND localPath=?', id, path);
}
/** Only temporary viewing copies are plaintext; persistent photos are authenticated ciphertext. */
export async function localUri(owner: string, id: string, path: string): Promise<string> {
  if (!validPath(owner, id, path)) throw new Error('Invalid vault path');
  const info = await FS.getInfoAsync(path);
  if (!info.exists || info.isDirectory || !info.size) throw new Error('Photo unavailable');
  if (path.endsWith('.mp4')) return path;
  const bytes = await plaintext(owner, id, path);
  try {
    await markEncrypted(owner, id, path);
    return await temporaryFile(bytes);
  } finally { bytes.fill(0); }
}
export async function wipe(owner: string): Promise<void> {
  // Clear encrypted-build credentials too, on explicit logout/wipe only.
  await SecureStore.deleteItemAsync(keyName(owner));
  await SecureStore.deleteItemAsync(photoKeyName(owner));
  await SecureStore.deleteItemAsync(`${keyName(owner)}.passcode`);
  await clearTemps();
  await close(owner);
  await FS.deleteAsync(directory(owner).replace(/simple\/$/, ''), { idempotent: true });
}
