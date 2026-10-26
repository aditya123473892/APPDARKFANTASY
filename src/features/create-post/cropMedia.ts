import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { UploadAsset } from '@/features/feed/types';
import { centerCrop } from '@/utils/imageLayout';

/** Aspect choices on the create screen; 'original' uploads the photo uncropped. */
export type AspectChoice = 'original' | 'square' | 'portrait' | 'landscape';
export const ASPECTS: { key: AspectChoice; label: string; a11y: string; ratio?: number }[] = [
  { key: 'original', label: 'Original', a11y: 'Original shape, no crop' },
  { key: 'square', label: '1:1', a11y: 'Square 1:1', ratio: 1 },
  { key: 'portrait', label: '4:5', a11y: 'Portrait 4:5', ratio: 4 / 5 },
  { key: 'landscape', label: '16:9', a11y: 'Landscape 16:9', ratio: 16 / 9 },
];
export const aspectRatioOf = (choice: AspectChoice) =>
  ASPECTS.find((aspect) => aspect.key === choice)?.ratio;

/**
 * Center-crops a photo on the device to the chosen shape before upload, so the
 * server stores (and every viewer sees) exactly the previewed frame. The
 * server itself never crops. Orientation is applied by the manipulator first.
 */
export async function cropToAspect(asset: UploadAsset, ratio: number): Promise<UploadAsset> {
  const context = ImageManipulator.manipulate(asset.uri);
  const source = await context.renderAsync();
  context.crop(centerCrop(source.width, source.height, ratio));
  const cropped = await context.renderAsync();
  const saved = await cropped.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: 'photo.jpg', type: 'image/jpeg' };
}
