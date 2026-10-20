import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { apiClient } from './apiClient';
import { serviceError, unwrap } from './backend';
import { ServiceError } from '../errors';
import { createClientId } from '@/utils/clientId';
import {
  assertSessionCurrent,
  registerSessionTeardown,
  sessionIdentity,
} from '@/features/auth/sessionRuntime';
import type { UploadAsset } from '@/features/feed/types';
import type { UploadProgressListener } from './uploadProgress';

type SignedUpload = {
  uploadId: string;
  status: 'pending' | 'approved';
  url?: string;
  fields?: Record<string, string>;
};
const completed = new WeakMap<UploadAsset, { generation: number; promise: Promise<string> }>();
const chatCompleted = new WeakMap<UploadAsset, { generation: number; promise: Promise<string> }>();
const controllers = new Set<AbortController>();
registerSessionTeardown(() => {
  for (const controller of controllers) controller.abort();
  controllers.clear();
});

/** Retry only a bounded, idempotent operation. Never print signed data or raw errors. */
export async function retryPhotoOperation<T>(
  operation: () => Promise<T>,
  scope: number,
  onAttempt?: (attempt: number) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    assertSessionCurrent(scope);
    onAttempt?.(attempt + 1);
    try {
      const result = await operation();
      assertSessionCurrent(scope);
      return result;
    } catch (error) {
      assertSessionCurrent(scope);
      if (error instanceof ServiceError && error.code !== 'NETWORK') throw error;
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : (error as { status?: number })?.status;
      const transient =
        status === undefined || [408, 409, 429, 500, 502, 503, 504].includes(status);
      if (attempt >= 3 || !transient || axios.isCancel(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt + Math.random() * 250));
    }
  }
}

export function uploadPhoto(asset: UploadAsset, onProgress?: UploadProgressListener): Promise<string> {
  const scope = sessionIdentity.generation;
  const cached = completed.get(asset);
  if (cached?.generation === scope) return cached.promise;
  const operation =
    Platform.OS === 'android'
      ? import('@/features/vault/vaultService').then(({ publishPhoto }) =>
          publishPhoto(asset, (prepared) => performUpload(prepared, scope, true, onProgress)),
        )
      : performUpload(asset, scope, false, onProgress);
  const promise = operation.catch((error) => {
    completed.delete(asset);
    if (error instanceof ServiceError) throw error;
    throw serviceError(error);
  });
  completed.set(asset, { generation: scope, promise });
  return promise;
}

/** Gallery-to-chat upload: no vault import, unlock, or persistent local copy. */
export function uploadChatPhoto(asset: UploadAsset, onProgress?: UploadProgressListener): Promise<string> {
  const scope = sessionIdentity.generation;
  const cached = chatCompleted.get(asset);
  if (cached?.generation === scope) return cached.promise;
  const promise = performUpload(asset, scope, false, onProgress).catch((error) => {
    chatCompleted.delete(asset);
    if (error instanceof ServiceError) throw error;
    throw serviceError(error);
  });
  chatCompleted.set(asset, { generation: scope, promise });
  return promise;
}

async function performUpload(asset: UploadAsset, scope: number, prepared = false,
  onProgress?: UploadProgressListener): Promise<string> {
  if (!asset.type.startsWith('image/'))
    throw new ServiceError('VALIDATION', 'Choose a photo. Video uploads are unavailable.');
  let temporaryUri: string | undefined;
  let stage: 'prepare' | 'request' | 'transfer' | 'confirm' = 'prepare';
  const notify = (attempt = 1, percent?: number) => {
    if (sessionIdentity.generation === scope) onProgress?.({ stage, attempt, percent });
  };
  try {
    assertSessionCurrent(scope);
    notify();
    let clean: { uri: string };
    if (prepared) clean = { uri: asset.uri };
    else {
      const context = ImageManipulator.manipulate(asset.uri);
      const source = await context.renderAsync();
      if (source.width > 1080) context.resize({ width: 1080 });
      const rendered = await context.renderAsync();
      clean = await rendered.saveAsync({
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: false,
      });
    }
    temporaryUri = clean.uri;
    let file: Blob | undefined;
    if (Platform.OS === 'web') {
      file = await (await fetch(clean.uri)).blob();
      if (file.size > 5 * 1024 * 1024)
        throw new ServiceError('VALIDATION', 'Choose a smaller photo (maximum 5MB).');
    } else {
      const info = await FileSystem.getInfoAsync(clean.uri);
      if (!info.exists || (info.size ?? 0) > 5 * 1024 * 1024)
        throw new ServiceError('VALIDATION', 'Choose a smaller photo (maximum 5MB).');
    }
    const requestId = createClientId();
    stage = 'request';
    const signed = await retryPhotoOperation(
      async () =>
        unwrap<SignedUpload>(
          (
            await apiClient.post('/photos/upload-url', {
              contentType: 'image/jpeg',
              requestId,
            })
          ).data,
        ),
      scope,
      (attempt) => notify(attempt),
    );
    if (signed.status !== 'approved') {
      const url = new URL(signed.url!);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !signed.fields ||
        !signed.fields.key
      ) {
        throw new ServiceError('UNKNOWN');
      }
      stage = 'transfer';
      let transferAttempt = 1;
      await retryPhotoOperation(async () => {
        const controller = new AbortController();
        controllers.add(controller);
        const timer = setTimeout(() => controller.abort(), 60_000);
        try {
          let status: number | undefined;
          if (Platform.OS === 'web') {
            const form = new FormData();
            for (const [key, value] of Object.entries(signed.fields!)) form.append(key, value);
            form.append('file', file!, 'photo.jpg');
            // API Authorization must never go to S3.
            const response = await fetch(url.toString(), {
              method: 'POST',
              body: form,
              signal: controller.signal,
              redirect: 'error',
            });
            status = response.status;
          } else {
            // Native multipart avoids JS fetch/FormData differences between Expo versions.
            const task = FileSystem.createUploadTask(url.toString(), clean.uri, {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: 'file',
              mimeType: 'image/jpeg',
              parameters: signed.fields!,
            }, (progress) => {
              if (progress.totalBytesExpectedToSend > 0) notify(transferAttempt,
                Math.min(100, Math.max(0, Math.round(progress.totalBytesSent * 100 / progress.totalBytesExpectedToSend))));
            });
            const cancel = () => {
              void task.cancelAsync().catch(() => undefined);
            };
            controller.signal.addEventListener('abort', cancel, { once: true });
            try {
              status = (await task.uploadAsync())?.status;
              if (controller.signal.aborted) throw new Error('Photo transfer cancelled');
            } finally {
              controller.signal.removeEventListener('abort', cancel);
            }
          }
          if (status !== 204) throw Object.assign(new Error('Photo upload failed'), { status });
        } finally {
          clearTimeout(timer);
          controllers.delete(controller);
        }
      }, scope, (attempt) => { transferAttempt = attempt; notify(attempt, 0); });
    }
    stage = 'confirm';
    await retryPhotoOperation(async () => {
      const result = unwrap<{ uploadId: string; status: string }>(
        (
          await apiClient.post(
            '/photos/confirm',
            {
              uploadId: signed.uploadId,
            },
            { timeout: 60_000 },
          )
        ).data,
      );
      if (result.status !== 'approved')
        throw new ServiceError('VALIDATION', 'Photo approval is pending. Try again.');
    }, scope, (attempt) => notify(attempt));
    onProgress?.({ stage: 'complete', percent: 100, attempt: 1 });
    return signed.uploadId;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : (error as { status?: number })?.status;
    if (status === 401) throw serviceError(error);
    const message = {
      prepare: 'Photo preparation failed. Restart the app and choose another image.',
      request:
        'Could not start the photo upload. Check that the backend is running and reachable from your phone.',
      transfer: 'The photo could not reach S3 storage. Check your connection and try again.',
      confirm:
        'The photo reached storage but the backend could not confirm it. Check the backend photo settings.',
    }[stage];
    throw new ServiceError('VALIDATION', `${message}${status ? ` (HTTP ${status})` : ''}`);
  } finally {
    if (temporaryUri && Platform.OS !== 'web')
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    if (temporaryUri?.startsWith('blob:')) URL.revokeObjectURL(temporaryUri);
  }
}

/** Only remove picker-created cache files, never user files outside app cache. */
export async function cleanupPickedAssets(assets: UploadAsset[]): Promise<void> {
  for (const asset of assets) {
    if (Platform.OS === 'web' && asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
    else if (FileSystem.cacheDirectory && asset.uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined);
    }
  }
}
