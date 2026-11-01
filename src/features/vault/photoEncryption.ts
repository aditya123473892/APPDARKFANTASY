import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { utf8ToBytes } from '@noble/hashes/utils';

const MAGIC = Uint8Array.of(68, 70, 86, 50); // DFV2: versioned AES-256-GCM envelope
const loading = new Map<string, Promise<AESEncryptionKey>>();
export const photoKeyName = (owner: string) => `darkfantasy.vault.${owner}.photo-key.v2`;
async function key(owner: string, create = false) {
  let pending = loading.get(owner);
  if (!pending) {
    pending = (async () => {
      const saved = await SecureStore.getItemAsync(photoKeyName(owner));
      if (saved) return AESEncryptionKey.import(saved, 'hex');
      if (!create) throw new Error('Local photo key unavailable. Restore a verified cloud backup.');
      const created = await AESEncryptionKey.generate();
      await SecureStore.setItemAsync(photoKeyName(owner), await created.encoded('hex'), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return created;
    })().finally(() => loading.delete(owner));
    loading.set(owner, pending);
  }
  return pending;
}
export function encryptedPhoto(bytes: Uint8Array) {
  return MAGIC.every((byte, index) => bytes[index] === byte);
}
export async function encryptPhoto(owner: string, id: string, bytes: Uint8Array) {
  const sealed = await aesEncryptAsync(bytes, await key(owner, true), { additionalData: utf8ToBytes(`${owner}:${id}:v2`) });
  const combined = await sealed.combined();
  const result = new Uint8Array(MAGIC.length + combined.length);
  result.set(MAGIC); result.set(combined, MAGIC.length); return result;
}
export async function decryptPhoto(owner: string, id: string, bytes: Uint8Array) {
  if (!encryptedPhoto(bytes)) throw new Error('Photo is not encrypted');
  return aesDecryptAsync(AESSealedData.fromCombined(bytes.subarray(MAGIC.length)), await key(owner), {
    additionalData: utf8ToBytes(`${owner}:${id}:v2`),
  });
}
