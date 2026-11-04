import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { toast } from '@/components/ui/Toast';
import {
  isSessionCurrent,
  registerSessionTeardown,
  sessionIdentity,
} from '@/features/auth/sessionRuntime';
import { insertCreatedPost } from '@/features/feed/hooks/useFeed';
import { mediaPreviews, previewKey } from '@/features/feed/presentation';
import { feedService } from '@/features/feed/services';
import type { CreatePostInput, UploadAsset } from '@/features/feed/types';
import { cleanupPickedAssets } from '@/services/api/photoUpload';
import { describeError } from '@/services/errors';
import { queryClient } from '@/services/queryClient';
import { uploadPostMedia } from './uploadSingleMedia';

/**
 * A post being published after its composer closed. Uploads resume from what
 * already finished on retry (each asset's upload is cached), and the post's
 * client ID makes the final create idempotent.
 */
export type PendingPost = {
  id: string;
  input: CreatePostInput & { assets: UploadAsset[] };
  /** Local image shown on the pending card. */
  cover?: string;
  /** Local video frames and durations for the new post's media, by index. */
  previews: { thumbnail?: string; duration?: number }[];
  progress: number;
  state: 'uploading' | 'finishing' | 'failed';
  error?: string;
};

export const usePostQueue = create<{ items: PendingPost[] }>(() => ({ items: [] }));

const update = (id: string, patch: Partial<PendingPost>) =>
  usePostQueue.setState((state) => ({
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  }));
const remove = (id: string) =>
  usePostQueue.setState((state) => ({ items: state.items.filter((item) => item.id !== id) }));

async function run(id: string): Promise<void> {
  const item = usePostQueue.getState().items.find((row) => row.id === id);
  if (!item) return;
  const scope = sessionIdentity.generation;
  update(id, { state: 'uploading', progress: 0, error: undefined });
  try {
    const post = await uploadPostMedia(
      item.input,
      (input) => feedService.create(input),
      (percent) => {
        // Uploads report up to 95%; the rest is the server creating the post.
        if (isSessionCurrent(scope))
          update(id, { progress: percent, state: percent >= 95 ? 'finishing' : 'uploading' });
      },
    );
    if (!isSessionCurrent(scope)) return;
    post.media?.forEach((media, index) => {
      if (media.uri) mediaPreviews.set(previewKey(media), { ...item.previews[index] });
    });
    insertCreatedPost(queryClient, post);
    remove(id);
    void cleanupPickedAssets(item.input.assets);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    toast.success(post.status === 'approved' ? 'Post published' : 'Post submitted for approval');
  } catch (cause) {
    if (!isSessionCurrent(scope)) return;
    update(id, { state: 'failed', error: describeError(cause, "Couldn't publish this post.") });
  }
}

/** Takes ownership of the post's assets: they are deleted once it is published or discarded. */
export function enqueuePost(post: Omit<PendingPost, 'progress' | 'state' | 'error'>): void {
  usePostQueue.setState((state) => ({
    items: [...state.items, { ...post, progress: 0, state: 'uploading' }],
  }));
  void run(post.id);
}
export function retryPost(id: string): void {
  void run(id);
}
export function discardPost(id: string): void {
  const item = usePostQueue.getState().items.find((row) => row.id === id);
  remove(id);
  if (item) void cleanupPickedAssets(item.input.assets);
}

registerSessionTeardown(() => {
  const { items } = usePostQueue.getState();
  usePostQueue.setState({ items: [] });
  void cleanupPickedAssets(items.flatMap((item) => item.input.assets));
});
