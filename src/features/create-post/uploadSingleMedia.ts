import type { CreatePostInput, Post } from '@/features/feed/types';
import { validatePostAssets } from './postMediaSelection';

/** Storage boundary: real publishing retains the existing upload/moderation service. */
export async function uploadSingleMedia(
  input: CreatePostInput,
  publish: (input: CreatePostInput) => Promise<Post>,
  onProgress: (percent: number) => void,
): Promise<Post> {
  if (input.assets?.length !== 1) throw new Error('Choose exactly one image or video.');
  return publish({
    ...input,
    onUploadProgress: (event) => {
      if (event.percent !== undefined) onProgress(event.percent);
      input.onUploadProgress?.(event);
    },
  });
}

export async function uploadPostMedia(
  input: CreatePostInput,
  publish: (input: CreatePostInput) => Promise<Post>,
  onProgress: (percent: number) => void,
): Promise<Post> {
  validatePostAssets(input.assets ?? []);
  return publish({
    ...input,
    onUploadProgress: (event) => {
      if (event.percent !== undefined) onProgress(event.percent);
      input.onUploadProgress?.(event);
    },
  });
}

/** Used only by the isolated UI preview; never sends data to storage. */
export async function simulateMediaUpload(onProgress: (percent: number) => void): Promise<void> {
  for (let percent = 0; percent <= 100; percent += 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    onProgress(percent);
  }
}
