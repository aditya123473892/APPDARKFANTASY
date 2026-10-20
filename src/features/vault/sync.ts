import { AppState } from 'react-native';
import * as Network from 'expo-network';
import * as FS from 'expo-file-system/legacy';
import { create } from 'zustand';
import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { unwrap } from '@/services/api/backend';
import {
  sessionIdentity,
  assertSessionCurrent,
  registerSessionTeardown,
} from '@/features/auth/sessionRuntime';
import * as repo from './repository';
import * as files from './files';
import { assertUnlocked, assertEpoch, useVaultLock, refreshVault } from './lock';
import { serial } from './vaultService';
import { hash } from './crypto';
import { retryDelay, remoteWins, sameRemotePhoto } from './conflicts';
import type { VaultPhoto, RemotePhoto, QueueJob } from './types';

export const useVaultNetwork = create<{ offline: boolean; syncing: boolean }>(() => ({
  offline: false,
  syncing: false,
}));
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const cancelTransfers = new Set<() => void>();
export function cancelVaultTransfers(): void {
  for (const cancel of cancelTransfers) cancel();
}
registerSessionTeardown(cancelVaultTransfers);
AppState.addEventListener('change', (s) => {
  if (s !== 'active') cancelVaultTransfers();
});
function signedURL(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Invalid storage destination');
  return url.toString();
}
async function remoteRequest<T>(fn: () => Promise<{ data: unknown }>): Promise<T> {
  const response = await fn();
  // This module handles terminal moderation separately from generic API errors.
  const body = response.data as { statusCode?: number; data: T };
  if (body.statusCode && body.statusCode >= 400)
    throw Object.assign(new Error('Sync failed'), { status: body.statusCode });
  return unwrap<T>(body);
}
async function canonicalBytes(
  owner: string,
  id: string,
): Promise<{ bytes: Uint8Array; photo: RemotePhoto }> {
  const scope = assertUnlocked(owner),
    session = sessionIdentity.generation;
  assertSessionCurrent(session);
  const { url, photo } = await remoteRequest<{ url: string; photo: RemotePhoto }>(() =>
    apiClient.get(`/vault/${id}/download-url`),
  );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  cancelTransfers.add(cancel);
  const timeout = setTimeout(cancel, 60_000);
  try {
    const response = await fetch(signedURL(url), {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Download failed');
    if (Number(response.headers.get('content-length')) > 5 * 1024 * 1024)
      throw new Error('Photo exceeds size limit');
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertSessionCurrent(session);
    assertEpoch(owner, scope);
    if (
      bytes.length > 5 * 1024 * 1024 ||
      bytes.length !== photo.size ||
      (await hash(bytes)) !== photo.sha256
    )
      throw new Error('Photo checksum failed');
    return { bytes, photo };
  } finally {
    clearTimeout(timeout);
    cancelTransfers.delete(cancel);
  }
}
export async function downloadPhoto(owner: string, id: string): Promise<void> {
  const scope = assertUnlocked(owner),
    session = sessionIdentity.generation;
  const { bytes, photo } = await canonicalBytes(owner, id);
  try {
    await serial(async () => {
      assertEpoch(owner, scope);
      assertSessionCurrent(session);
      const local = await repo.get(owner, id);
      if (local?.deletedAt || !local?.s3Key) throw new Error('No cloud copy is available.');
      assertEpoch(owner, scope);
      assertSessionCurrent(session);
      const path = await files.store(owner, id, bytes);
      assertEpoch(owner, scope);
      assertSessionCurrent(session);
      await repo.save(owner, { ...local, localPath: path, sha256: photo.sha256, size: photo.size });
      refreshVault();
    });
  } finally {
    bytes.fill(0);
  }
}
async function upload(owner: string, photo: VaultPhoto, valid: () => void): Promise<RemotePhoto> {
  if (!photo.localPath) throw new Error('Local photo missing');
  valid();
  const signed = await remoteRequest<{
    status: string;
    url?: string;
    fields?: Record<string, string>;
    photo?: RemotePhoto;
  }>(() =>
    apiClient.post('/vault/upload-url', {
      id: photo.id,
      hidden: Boolean(photo.hidden),
      order: photo.sortOrder,
      updatedAt: photo.updatedAt,
    }),
  );
  if (signed.status === 'rejected')
    throw Object.assign(new Error('Moderation rejected'), { status: 422 });
  if (signed.status !== 'approved') {
    const bytes = await files.plaintext(owner, photo.id, photo.localPath);
    let uri: string | undefined;
    try {
      valid();
      uri = await files.temporaryFile(bytes);
      valid();
      if (!signed.fields?.key) throw new Error('Invalid upload response');
      const task = FS.createUploadTask(signedURL(signed.url!), uri, {
        httpMethod: 'POST',
        uploadType: FS.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        parameters: signed.fields,
      });
      const cancel = () => {
        void task.cancelAsync().catch(() => undefined);
      };
      cancelTransfers.add(cancel);
      const timeout = setTimeout(cancel, 60_000);
      try {
        const result = await task.uploadAsync();
        valid();
        if (result?.status !== 204)
          throw Object.assign(new Error('Upload failed'), { status: result?.status });
      } finally {
        clearTimeout(timeout);
        cancelTransfers.delete(cancel);
      }
    } finally {
      bytes.fill(0);
      if (uri) await files.removeTemp(uri);
    }
  }
  valid();
  const confirmed = await remoteRequest<RemotePhoto>(() =>
    apiClient.post('/vault/confirm', { id: photo.id }, { timeout: 60_000 }),
  );
  if (confirmed.deletedAt) return confirmed;
  return remoteRequest<RemotePhoto>(() =>
    apiClient.patch(`/vault/${photo.id}`, {
      hidden: Boolean(photo.hidden),
      order: photo.sortOrder,
      updatedAt: photo.updatedAt,
    }),
  );
}
export async function processQueue(owner: string, valid: () => void): Promise<void> {
  const db = await repo.database(owner);
  const jobs = await db.getAllAsync<QueueJob>(
    "SELECT * FROM queue WHERE nextAttemptAt<=? ORDER BY CASE operation WHEN 'delete' THEN 0 WHEN 'upload' THEN 1 ELSE 2 END",
    Date.now(),
  );
  for (const job of jobs) {
    valid();
    const initial = await serial(async () => {
      valid();
      const current = await repo.get(owner, job.photoId);
      if (
        current &&
        !(current.deletedAt && job.operation !== 'delete') &&
        !(current.syncState === 'rejected' && job.operation !== 'delete')
      )
        await repo.save(owner, { ...current, syncState: 'syncing', error: null });
      return current;
    });
    if (!initial) {
      await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
      continue;
    }
    const photo: VaultPhoto = initial;
    if (photo.syncState === 'rejected' && job.operation !== 'delete') {
      await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
      continue;
    }
    if (photo.deletedAt && job.operation !== 'delete') {
      await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
      continue;
    }
    try {
      refreshVault();
      if (job.operation === 'delete') {
        await remoteRequest(() =>
          apiClient.delete(`/vault/${photo.id}`, { data: { updatedAt: photo.updatedAt } }),
        );
        await serial(async () => {
          valid();
          const latest = await repo.get(owner, photo.id);
          if (!latest) return;
          await db.runAsync('DELETE FROM queue WHERE photoId=?', photo.id);
          await repo.save(owner, { ...latest, localPath: null, syncState: 'synced' });
        });
      } else {
        const remote =
          job.operation === 'upload'
            ? await upload(owner, photo, valid)
            : await remoteRequest<RemotePhoto>(() =>
                apiClient.patch(`/vault/${photo.id}`, {
                  hidden: Boolean(photo.hidden),
                  order: photo.sortOrder,
                  updatedAt: photo.updatedAt,
                }),
              );
        valid();
        const canonical =
          job.operation === 'upload' && !remote.deletedAt
            ? await canonicalBytes(owner, photo.id)
            : null;
        try {
          await serial(async () => {
            valid();
            const latest = await repo.get(owner, photo.id);
            if (!latest) return;
            if (latest.deletedAt) {
              await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
              return;
            }
            if (remote.deletedAt) {
              if (latest.localPath) await FS.deleteAsync(latest.localPath, { idempotent: true });
              await repo.save(owner, {
                ...latest,
                ...remote,
                localPath: null,
                syncState: 'synced',
                error: null,
              });
              await db.runAsync('DELETE FROM queue WHERE photoId=?', photo.id);
              return;
            }
            const newerLocalEdit = latest.updatedAt > photo.updatedAt;
            let path = latest.localPath;
            if (canonical) {
              path = await files.store(owner, photo.id, canonical.bytes);
              valid();
            }
            const server = canonical?.photo ?? remote;
            const merged: VaultPhoto = {
              ...latest,
              ...server,
              localPath: path,
              syncState: newerLocalEdit ? 'pending' : 'synced',
              error: null,
            };
            if (newerLocalEdit) {
              merged.hidden = latest.hidden;
              merged.sortOrder = latest.sortOrder;
              merged.updatedAt = latest.updatedAt;
            }
            await repo.save(owner, merged, newerLocalEdit ? 'patch' : undefined);
            if (!newerLocalEdit || job.operation === 'upload')
              await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
            else
              await db.runAsync('UPDATE queue SET attempts=0,nextAttemptAt=0 WHERE id=?', job.id);
          });
        } finally {
          canonical?.bytes.fill(0);
        }
      }
    } catch (error) {
      valid();
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : (error as { status?: number }).status;
      const rejected = status === 422;
      await serial(async () => {
        valid();
        const latest = await repo.get(owner, photo.id);
        if (!latest) return;
        if (latest.deletedAt && job.operation !== 'delete') {
          await db.runAsync('DELETE FROM queue WHERE id=?', job.id);
          return;
        }
        await repo.save(owner, {
          ...latest,
          syncState: rejected ? 'rejected' : 'failed',
          status: rejected ? 'rejected' : latest.status,
          error: rejected
            ? 'Photo did not pass moderation. Delete it to remove it.'
            : status === 401
              ? 'Sign in again to back up this photo.'
              : status === 403
                ? 'Backup was denied. Check your account and storage permissions.'
                : status === 503
                  ? 'Photo storage is unavailable. Try backup again later.'
                  : 'Could not finish photo backup. Your local photo is saved. Tap Retry.',
        });
        if (rejected)
          await db.runAsync("DELETE FROM queue WHERE photoId=? AND operation!='delete'", photo.id);
        else
          await db.runAsync(
            'UPDATE queue SET attempts=attempts+1,nextAttemptAt=? WHERE id=?',
            Date.now() + retryDelay(job.attempts),
            job.id,
          );
      });
    }
    refreshVault();
  }
}
async function pull(owner: string, valid: () => void): Promise<void> {
  // A resumable ordered metadata sweep avoids timestamp cursor gaps and transaction requirements.
  let cursor = (await repo.setting(owner, 'cursor')) || '';
  do {
    valid();
    const page = await remoteRequest<{ items: RemotePhoto[]; cursor: string | null }>(() =>
      apiClient.get('/vault/changes', { params: { since: cursor } }),
    );
    valid();
    let changed = false;
    for (const remote of page.items) {
      await serial(async () => {
        valid();
        const local = await repo.get(owner, remote.id);
        if (remoteWins(local, remote) && !sameRemotePhoto(local, remote)) {
          let path = local?.localPath ?? null;
          if (remote.deletedAt || (local && local.sha256 !== remote.sha256)) {
            if (path) await FS.deleteAsync(path, { idempotent: true });
            path = null;
          }
          await repo.save(owner, {
            ...remote,
            localPath: path,
            syncState: remote.status === 'rejected' ? 'rejected' : 'synced',
            error:
              remote.status === 'rejected'
                ? 'Photo did not pass moderation. You can delete it.'
                : null,
          });
          await (
            await repo.database(owner)
          ).runAsync('DELETE FROM queue WHERE photoId=?', remote.id);
          changed = true;
        }
      });
    }
    cursor = page.cursor ?? '';
    await repo.setSetting(owner, 'cursor', cursor);
    if (changed) refreshVault();
  } while (cursor);
}
export function syncVault(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { owner, unlocked } = useVaultLock.getState();
    if (
      !owner ||
      !unlocked ||
      AppState.currentState !== 'active' ||
      sessionIdentity.userId !== owner
    )
      return;
    const network = await Network.getNetworkStateAsync();
    const offline = !network.isConnected || network.isInternetReachable === false;
    useVaultNetwork.setState({ offline });
    if (offline) return;
    const scope = assertUnlocked(owner),
      session = sessionIdentity.generation;
    const valid = () => {
      assertEpoch(owner, scope);
      assertSessionCurrent(session);
    };
    useVaultNetwork.setState({ syncing: true });
    try {
      // Restore the library before potentially slow queued uploads.
      try {
        await pull(owner, valid);
      } catch {
        valid();
      } // A failed library refresh must not block saved uploads/deletes.
      await processQueue(owner, valid);
      await pull(owner, valid);
    } finally {
      useVaultNetwork.setState({ syncing: false });
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      running = null;
    });
  return running;
}
export async function retrySync(owner: string): Promise<void> {
  assertUnlocked(owner);
  await (await repo.database(owner)).runAsync('UPDATE queue SET nextAttemptAt=0');
  await syncVault();
}
export function startSync(): () => void {
  void Network.getNetworkStateAsync()
    .then((state) =>
      useVaultNetwork.setState({
        offline: !state.isConnected || state.isInternetReachable === false,
      }),
    )
    .catch(() => undefined);
  let disposed = false;
  const tick = () => {
    if (disposed) return;
    void syncVault().finally(() => {
      if (!disposed) timer = setTimeout(tick, 15_000);
    });
  };
  tick();
  const network = Network.addNetworkStateListener((state) => {
    useVaultNetwork.setState({
      offline: !state.isConnected || state.isInternetReachable === false,
    });
    if (state.isConnected) void syncVault();
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncVault();
  });
  const unlockSub = useVaultLock.subscribe((state) => {
    if (state.unlocked) void syncVault();
  });
  return () => {
    disposed = true;
    clearTimeout(timer);
    network.remove();
    app.remove();
    unlockSub();
    cancelVaultTransfers();
  };
}
