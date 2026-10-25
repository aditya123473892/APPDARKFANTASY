import { create } from 'zustand';
import type { Post, PostMedia } from './types';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';

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
export const postRatio = (media?: PostMedia) => {
  const explicit = mediaPreviews.get(media?.uri ?? '')?.ratio;
  if (explicit) return explicit;
  const ratio = media?.width && media.height ? media.width / media.height : 0.8;
  return [1, 0.8, 16 / 9].reduce(
    (best, value) => (Math.abs(value - ratio) < Math.abs(best - ratio) ? value : best),
    0.8,
  );
};
export const durationLabel = (seconds = 0) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
registerSessionTeardown(() => {
  usePostPresentation.setState({ saved: {} });
  mediaPreviews.clear();
});
