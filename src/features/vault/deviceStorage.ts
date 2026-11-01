import * as FS from 'expo-file-system/legacy';
import * as repo from './repository';
import * as files from './files';
import { assertUnlocked, assertEpoch, refreshVault } from './lock';
import { serial } from './vaultService';

/** Free app storage without deleting the confirmed cloud backup or Gallery copies. */
export async function removeDeviceCopies(owner: string, ids: string[]): Promise<void> {
  const scope = assertUnlocked(owner);
  await serial(async () => {
    assertEpoch(owner, scope);
    const photos = await Promise.all([...new Set(ids)].map((id) => repo.get(owner, id)));
    // Validate the entire selection before removing any files.
    for (const photo of photos) {
      if (!photo || photo.deletedAt) throw new Error('This item is no longer in your vault.');
      if (!photo.s3Key || photo.status !== 'approved' || photo.syncState !== 'synced')
        throw new Error(
          'Wait until every selected item is backed up before removing device copies.',
        );
    }
    for (const photo of photos) {
      assertEpoch(owner, scope);
      if (!photo?.localPath) continue;
      const path = await files.localUri(owner, photo.id, photo.localPath);
      assertEpoch(owner, scope);
      await FS.deleteAsync(path, { idempotent: true });
      // Local storage state only: no tombstone, timestamp change, or server delete job.
      await repo.save(owner, { ...photo, localPath: null });
    }
  }).finally(refreshVault);
}
