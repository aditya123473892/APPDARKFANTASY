import type { VaultPhoto } from './types';
export function backupStatus(photo: VaultPhoto): string {
  const localSafe = photo.kind !== 'video' && !!photo.localPath && photo.localEncrypted === 1;
  const cloudSafe = !!photo.s3Key && photo.status === 'approved' && photo.syncState === 'synced' && photo.remoteEncrypted === true;
  if (cloudSafe && (localSafe || !photo.localPath)) return 'Encrypted and securely backed up.';
  if (localSafe && photo.syncState === 'failed') return 'Backup could not be completed. Your encrypted local copy is safe. Retry backup.';
  if (photo.s3Key && photo.status === 'approved' && photo.syncState === 'synced' && !photo.remoteEncrypted)
    return localSafe ? 'Encrypted locally. Cloud backup saved; cloud encryption verification pending.'
      : 'Cloud backup saved. Encryption verification pending.';
  if (localSafe) return 'Encrypted and saved locally. Cloud backup pending.';
  if (photo.syncState === 'failed') return 'Backup could not be completed. Retry backup.';
  if (cloudSafe) return 'Cloud backup encryption verified. Local encryption pending.';
  return 'Cloud backup pending. Keep your device copy.';
}
