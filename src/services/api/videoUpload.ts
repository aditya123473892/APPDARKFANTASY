import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { apiClient } from './apiClient';
import { serviceError, unwrap } from './backend';
import { ServiceError } from '../errors';
import { createClientId } from '@/utils/clientId';
import { assertSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';
import { retryPhotoOperation } from './photoUpload';
import type { UploadAsset } from '@/features/feed/types';
import type { UploadProgressListener } from './uploadProgress';

export const POST_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
type VideoStatus = { uploadId: string; status: 'pending' | 'scanning' | 'approved' };
type SignedVideo = VideoStatus & { url?: string; fields?: Record<string, string> };
const contentTypeOf = (asset: UploadAsset) =>
  asset.type === 'video/quicktime' || /\.mov$/i.test(asset.name) ? 'video/quicktime' : 'video/mp4';

async function sizeOf(asset: UploadAsset): Promise<number> {
  if (Platform.OS === 'web')
    return asset.file?.size ?? (await (await fetch(asset.uri)).blob()).size;
  const info = await FileSystem.getInfoAsync(asset.uri);
  return info.exists && !info.isDirectory ? (info.size ?? 0) : 0;
}

/**
 * Post video: presigned upload of the original file, then the server scans it
 * (Rekognition). Resolves the upload ID only once the video is approved, so a
 * post can never reference an unscanned video.
 */
export async function uploadVideo(
  asset: UploadAsset,
  onProgress?: UploadProgressListener,
): Promise<string> {
  const scope = sessionIdentity.generation;
  let stage: 'prepare' | 'request' | 'transfer' | 'confirm' = 'prepare';
  const notify = (attempt = 1, percent?: number) => {
    if (sessionIdentity.generation === scope)
      onProgress?.({ stage, attempt, percent, kind: 'video' });
  };
  try {
    assertSessionCurrent(scope);
    notify();
    const size = await sizeOf(asset);
    if (!size)
      throw new ServiceError('VALIDATION', 'This video could not be read. Choose another one.');
    if (size > POST_VIDEO_MAX_BYTES)
      throw new ServiceError('VALIDATION', 'Choose a shorter video (maximum 50 MB).');
    const contentType = contentTypeOf(asset);
    const requestId = createClientId();
    stage = 'request';
    const signed = await retryPhotoOperation(
      async () =>
        unwrap<SignedVideo>(
          (await apiClient.post('/videos/upload-url', { contentType, requestId, size })).data,
        ),
      scope,
      (attempt) => notify(attempt),
    );
    if (signed.status === 'pending') {
      const url = new URL(signed.url!);
      if (url.protocol !== 'https:' || url.username || url.password || !signed.fields?.key)
        throw new ServiceError('UNKNOWN');
      stage = 'transfer';
      let transferAttempt = 1;
      await retryPhotoOperation(
        async () => {
          let status: number | undefined;
          if (Platform.OS === 'web') {
            const form = new FormData();
            for (const [key, value] of Object.entries(signed.fields!)) form.append(key, value);
            form.append('file', asset.file ?? (await (await fetch(asset.uri)).blob()), asset.name);
            status = (
              await fetch(url.toString(), { method: 'POST', body: form, redirect: 'error' })
            ).status;
          } else {
            const task = FileSystem.createUploadTask(
              url.toString(),
              asset.uri,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                mimeType: contentType,
                parameters: signed.fields!,
              },
              (progress) => {
                if (progress.totalBytesExpectedToSend > 0)
                  notify(
                    transferAttempt,
                    Math.min(
                      100,
                      Math.round(
                        (progress.totalBytesSent * 100) / progress.totalBytesExpectedToSend,
                      ),
                    ),
                  );
              },
            );
            const timer = setTimeout(() => void task.cancelAsync().catch(() => undefined), 600_000);
            try {
              status = (await task.uploadAsync())?.status;
            } finally {
              clearTimeout(timer);
            }
          }
          if (status !== 204) throw Object.assign(new Error('Video upload failed'), { status });
        },
        scope,
        (attempt) => {
          transferAttempt = attempt;
          notify(attempt, 0);
        },
      );
    }
    stage = 'confirm';
    let result = await retryPhotoOperation(
      async () =>
        unwrap<VideoStatus>(
          (
            await apiClient.post(
              '/videos/confirm',
              { uploadId: signed.uploadId },
              { timeout: 60_000 },
            )
          ).data,
        ),
      scope,
      (attempt) => notify(attempt),
    );
    // Moderation runs asynchronously; poll for up to five minutes.
    for (let poll = 0; result.status !== 'approved'; poll++) {
      if (poll >= 100)
        throw new ServiceError(
          'VALIDATION',
          'The video check is taking longer than usual. Try posting again shortly.',
        );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      assertSessionCurrent(scope);
      notify();
      result = unwrap<VideoStatus>((await apiClient.get(`/videos/${signed.uploadId}`)).data);
    }
    onProgress?.({ stage: 'complete', percent: 100, attempt: 1, kind: 'video' });
    return signed.uploadId;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : (error as { status?: number })?.status;
    if (status === 401) throw serviceError(error);
    if (status === 422)
      throw new ServiceError(
        'VALIDATION',
        'This video didn’t pass our content check and can’t be posted.',
      );
    const message = {
      prepare: 'This video could not be prepared. Choose another one.',
      request: 'Could not start the video upload. Check your connection and try again.',
      transfer: 'The video could not be uploaded. Check your connection and try again.',
      confirm: 'The video was uploaded but could not be checked. Try again shortly.',
    }[stage];
    throw new ServiceError('VALIDATION', `${message}${status ? ` (HTTP ${status})` : ''}`);
  }
}
