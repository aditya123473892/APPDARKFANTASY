import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, serviceError, unwrap } from '@/services/api/backend';
import type { UserSummary } from '@/features/auth/userModel';
import { displayName } from '@/features/auth/userModel';

export const flagReasons = [
  'nudity_sexual',
  'violence_threat',
  'harassment',
  'hate',
  'spam_scam',
  'impersonation',
  'underage',
  'self_harm',
  'fake_profile',
  'other',
] as const;
export type FlagReason = (typeof flagReasons)[number];
export type MediaFilter = 'all' | 'flagged' | 'premium' | 'video';
export type AdminMediaItem = {
  kind: 'photo' | 'video';
  uri: string;
  width: number;
  height: number;
};
export type AdminPost = {
  id: string;
  caption: string;
  owner: string;
  createdAt?: string;
  status: string;
  premium: boolean;
  flag: { reason: FlagReason; note: string; hidden: boolean; at?: string } | null;
  media: AdminMediaItem[];
};
type BackendAdminPost = {
  _id: string;
  caption?: string;
  user?: string | UserSummary;
  createdAt?: string;
  status?: string;
  contentVisibility?: 'normal' | 'premium';
  flag?: AdminPost['flag'];
  images?: { url?: string; width?: number | null; height?: number | null }[];
  videos?: { url?: string }[];
};

export const reasonLabel = (reason: string) =>
  reason.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

function mapAdminPost(raw: BackendAdminPost): AdminPost {
  return {
    id: raw._id,
    caption: raw.caption ?? '',
    owner: typeof raw.user === 'object' && raw.user ? displayName(raw.user) : 'Unknown member',
    createdAt: raw.createdAt,
    status: raw.status ?? 'approved',
    premium: raw.contentVisibility === 'premium',
    flag: raw.flag ?? null,
    media: [
      ...(raw.videos ?? []).map((video) => ({
        kind: 'video' as const,
        uri: mediaUrl(video.url),
        width: 0,
        height: 0,
      })),
      ...(raw.images ?? []).map((image) => ({
        kind: 'photo' as const,
        uri: mediaUrl(image.url),
        width: image.width ?? 0,
        height: image.height ?? 0,
      })),
    ],
  };
}

export async function listAdminMedia(filter: MediaFilter, before?: string) {
  const data = await getData<{ posts: BackendAdminPost[]; nextCursor: string | null }>(
    '/admin/posts/media',
    {
      filter,
      ...(before ? { before } : {}),
    },
  );
  return { posts: (data.posts ?? []).map(mapAdminPost), nextCursor: data.nextCursor };
}
export async function setPremium(id: string, premium: boolean): Promise<void> {
  try {
    unwrap(
      (
        await apiClient.patch(`/admin/posts/${id}/content-visibility`, {
          contentVisibility: premium ? 'premium' : 'normal',
        })
      ).data,
    );
  } catch (error) {
    throw serviceError(error);
  }
}
export async function setFlag(
  id: string,
  flag: { reason: FlagReason; note?: string; hide: boolean } | null,
): Promise<void> {
  try {
    unwrap(
      (
        await apiClient.patch(
          `/admin/posts/${id}/flag`,
          flag ? { flagged: true, ...flag } : { flagged: false },
        )
      ).data,
    );
  } catch (error) {
    throw serviceError(error);
  }
}
