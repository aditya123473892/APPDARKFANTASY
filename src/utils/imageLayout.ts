/** Use the actual photo shape, including very tall portraits and wide panoramas. */
export function imageAspectRatio(width?: number, height?: number): number | undefined {
  return width != null &&
    height != null &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? width / height
    : undefined;
}

/** Feed frame limits, as on Instagram: 4:5 portrait up to 1.91:1 landscape. */
export const FEED_MIN_RATIO = 0.8;
export const FEED_MAX_RATIO = 1.91;
/** Frame for images whose size is not known yet (legacy rows); replaced once decoded. */
export const FEED_FALLBACK_RATIO = 1;

export type ImageFit = 'contain' | 'cover';

/**
 * Feed frame (width / height) for an image and how it fills that frame. Images
 * within the limits show whole; only images beyond them are cropped (cover) to
 * the nearest limit. Unknown sizes get a square frame and are never cropped.
 */
export function feedFrame(width?: number, height?: number): { ratio: number; fit: ImageFit } {
  const natural = imageAspectRatio(width, height);
  if (natural === undefined) return { ratio: FEED_FALLBACK_RATIO, fit: 'contain' };
  const ratio = Math.min(FEED_MAX_RATIO, Math.max(FEED_MIN_RATIO, natural));
  return { ratio, fit: ratio === natural ? 'contain' : 'cover' };
}

/** Centered crop rectangle that gives `ratio` (width / height) from a width × height image. */
export function centerCrop(width: number, height: number, ratio: number) {
  if (width / height > ratio) {
    const cropWidth = Math.max(1, Math.round(height * ratio));
    return { originX: Math.floor((width - cropWidth) / 2), originY: 0, width: cropWidth, height };
  }
  const cropHeight = Math.max(1, Math.round(width / ratio));
  return { originX: 0, originY: Math.floor((height - cropHeight) / 2), width, height: cropHeight };
}
