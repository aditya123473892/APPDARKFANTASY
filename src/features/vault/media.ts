import * as repo from './repository';
import * as files from './files';
import { assertUnlocked, assertEpoch } from './lock';
import { downloadPhoto } from './sync';
import { sessionIdentity } from '@/features/auth/sessionRuntime';

// A grid and viewer can request the same restored photo together. Share network work,
// cap downloads, and keep all local-file hits outside that queue.
const downloads = new Map<string, Promise<void>>();
const waiting: (() => void)[] = [];
let activeDownloads = 0;
async function downloadLimited(work: () => Promise<void>): Promise<void> {
  if (activeDownloads >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else activeDownloads++;
  try {
    await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeDownloads--;
  }
}
export async function photoUri(owner: string, id: string, repair = false): Promise<string> {
  const scope = assertUnlocked(owner);
  let photo = await repo.get(owner, id);
  if (!photo || photo.deletedAt) throw new Error('Photo unavailable');
  if (!repair && photo.localPath) {
    try {
      const uri = await files.localUri(owner, id, photo.localPath);
      assertEpoch(owner, scope);
      return uri;
    } catch {
      assertEpoch(owner, scope);
      // Missing files can be restored below; a local-only photo must never be overwritten.
    }
  }
  if (!photo.s3Key || photo.status === 'rejected') throw new Error('Photo unavailable');
  const key = `${owner}:${id}:${scope}:${sessionIdentity.generation}`;
  let pending = downloads.get(key);
  if (!pending) {
    pending = downloadLimited(async () => {
      assertEpoch(owner, scope);
      await downloadPhoto(owner, id);
    }).finally(() => downloads.delete(key));
    downloads.set(key, pending);
  }
  await pending;
  assertEpoch(owner, scope);
  photo = await repo.get(owner, id);
  if (!photo || photo.deletedAt || !photo.localPath) throw new Error('Photo unavailable');
  const uri = await files.localUri(owner, id, photo.localPath);
  assertEpoch(owner, scope);
  return uri;
}
