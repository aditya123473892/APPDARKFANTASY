import { Buffer } from '@craftzdog/react-native-buffer';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  pbkdf2,
  timingSafeEqual,
} from 'react-native-quick-crypto';

// Version || 96-bit random nonce || 128-bit authentication tag || ciphertext.
// AAD binds the envelope to its owner and immutable photo ID.
export function encrypt(bytes: Uint8Array, key: Uint8Array, context: string): Uint8Array {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), body]);
}
export function decrypt(bytes: Uint8Array, key: Uint8Array, context: string): Uint8Array {
  if (bytes.length < 30 || bytes[0] !== 1) throw new Error('Invalid vault file');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.slice(1, 13));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(bytes.slice(13, 29)));
  return Buffer.concat([cipher.update(bytes.slice(29)), cipher.final()]);
}
export const newKey = (): string => randomBytes(32).toString('base64');
export const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export const uuid = (): string => {
  const b = randomBytes(16);
  b[6] = (b[6]! & 15) | 64;
  b[8] = (b[8]! & 63) | 128;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export function passcodeHash(passcode: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) =>
    pbkdf2(passcode, salt, 600_000, 32, 'sha256', (error, result) => {
      if (error || !result) reject(new Error('Passcode verification failed'));
      else resolve(result.toString('base64'));
    }),
  );
}
export function equalHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'base64'),
    y = Buffer.from(b, 'base64');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
