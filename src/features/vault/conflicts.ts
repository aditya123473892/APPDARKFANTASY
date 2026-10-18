import type { VaultPhoto, RemotePhoto } from './types';
export const retryDelay = (attempt: number, jitter = Math.random()): number =>
  Math.min(3_600_000, 1000 * 2 ** Math.min(attempt, 12)) + Math.floor(jitter * 1000);
export function remoteWins(local: VaultPhoto | null, remote: RemotePhoto): boolean {
  if (!local) return true;
  if (local.deletedAt) return false;
  if (remote.deletedAt) return true;
  return (
    remote.updatedAt > local.updatedAt ||
    (remote.updatedAt === local.updatedAt && local.syncState === 'synced')
  );
}
