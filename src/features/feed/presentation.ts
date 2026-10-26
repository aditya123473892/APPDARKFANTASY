import { create } from 'zustand';
import type { Post, PostMedia } from './types';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { FEED_MIN_RATIO, feedFrame, type ImageFit } from '@/utils/imageLayout';

/** Presentation state only; the backend post shape remains unchanged. */
export const usePostPresentation = create<{
  saved: Record<string, Post>;
  toggleSaved: (post: Post) => void;
}>((set) => ({
  saved: {},
  toggleSaved: (post) =>
    set(({ saved }) => {
      const next = { ...saved };
      if (next[post.id]) delete next[post.id];
      else next[post.id] = post;
      return { saved: next };
    }),
}));

export type MediaPreview = {
  thumbnail?: string;
  duration?: number;
  location?: string;
  ratio?: number;
};
export const mediaPreviews = new Map<string, MediaPreview>();
export const singleMedia = (post: Post): PostMedia | undefined => post.media?.[0];
export const isVideo = (media?: PostMedia) => Boolean(media?.mimetype?.startsWith('video/'));
/**
 * Feed frame from the stored size, clamped to 4:5…1.91:1 (never snapped to a
 * few presets, which cropped most photos). Videos of unknown size keep the
 * portrait 4:5 frame they always had.
 */
export const mediaFrame = (media?: PostMedia): { ratio: number; fit: ImageFit } =>
  isVideo(media) && !(media?.width && media.height)
    ? { ratio: FEED_MIN_RATIO, fit: 'cover' }
    : feedFrame(media?.width, media?.height);
export const postRatio = (media?: PostMedia) =>
  mediaPreviews.get(media?.uri ?? '')?.ratio ?? mediaFrame(media).ratio;
export const durationLabel = (seconds = 0) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
registerSessionTeardown(() => {
  usePostPresentation.setState({ saved: {} });
  mediaPreviews.clear();
});
