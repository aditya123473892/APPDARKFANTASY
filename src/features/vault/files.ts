import * as FS from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from '@craftzdog/react-native-buffer';
import { encrypt, decrypt, newKey, uuid } from './crypto';
import { directory, close } from './repository';

const keyName = (owner: string) => `darkfantasy.vault.${owner}`;
const temporary = new Set<string>();
export const tempDirectory = () => {
  if (!FS.cacheDirectory) throw new Error('Vault requires Android');
  return `${FS.cacheDirectory}vault-temp/`;
};
export async function key(owner: string, create = false): Promise<Uint8Array> {
  let value = await SecureStore.getItemAsync(keyName(owner));
  if (!value && create) {
    const existing = await FS.readDirectoryAsync(directory(owner)).catch(() => [] as string[]);
    if (existing.some(name => name.endsWith('.vault')))
      throw new Error('The local vault key is missing. Wipe this vault after checking cloud sync before creating a new key.');
    value = newKey();
    await SecureStore.setItemAsync(keyName(owner), value);
  }
  if (!value) throw new Error('Local vault key is unavailable. Download the cloud copy again.');
  return Buffer.from(value, 'base64');
}
export async function read(uri: string): Promise<Uint8Array> {
  return Buffer.from(
    await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 }),
    'base64',
  );
}
export async function store(owner: string, id: string, bytes: Uint8Array): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid photo');
  if ((await FS.getFreeDiskStorageAsync()) < bytes.length * 3 + 10 * 1024 * 1024)
    throw new Error('Not enough storage for this photo.');
  const dir = directory(owner);
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const secret = await key(owner, true);
  let encrypted: Uint8Array;
  try {
    encrypted = encrypt(bytes, secret, `${owner}:${id}`);
  } finally {
    secret.fill(0);
  }
  const path = `${dir}${id}.vault`,
    partial = `${path}.partial`;
  await FS.writeAsStringAsync(partial, Buffer.from(encrypted).toString('base64'), {
    encoding: FS.EncodingType.Base64,
  });
  await FS.moveAsync({ from: partial, to: path });
  return path;
}
export async function clearTemps(): Promise<void> {
  temporary.clear();
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
  temporary.add(uri);
  await FS.writeAsStringAsync(uri, Buffer.from(bytes).toString('base64'), {
    encoding: FS.EncodingType.Base64,
  });
  return uri;
}
export async function removeTemp(uri: string): Promise<void> {
  if (!uri.startsWith(tempDirectory())) return;
  await FS.deleteAsync(uri, { idempotent: true });
  temporary.delete(uri);
}
export async function plaintext(owner: string, id: string, path: string): Promise<Uint8Array> {
  if (path !== `${directory(owner)}${id}.vault`) throw new Error('Invalid vault path');
  const secret = await key(owner);
  try {
    return decrypt(await read(path), secret, `${owner}:${id}`);
  } finally {
    secret.fill(0);
  }
}
export async function wipe(owner: string): Promise<void> {
  // Destroy the key first, even if filesystem cleanup fails.
  await SecureStore.deleteItemAsync(keyName(owner));
  await SecureStore.deleteItemAsync(`${keyName(owner)}.passcode`);
  await clearTemps();
  await close(owner);
  await FS.deleteAsync(directory(owner), { idempotent: true });
}
