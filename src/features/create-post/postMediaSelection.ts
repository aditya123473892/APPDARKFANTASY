import type { UploadAsset } from '@/features/feed/types';
import { POST_MAX_PHOTOS } from './singleMedia';

export function validatePostAssets(assets: UploadAsset[]) {
  if (!assets.length) throw new Error('Choose a photo or video before posting.');
  if (assets.length > POST_MAX_PHOTOS) throw new Error(`Choose up to ${POST_MAX_PHOTOS} photos.`);
  if (assets.length > 1 && assets.some((asset) => asset.type.startsWith('video/')))
    throw new Error('Choose multiple photos or one video. Videos cannot be combined with photos.');
}
