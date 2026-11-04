import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { queryKeys } from '@/services/queryKeys';
import { profileService } from '../services';
import type { UpdateProfileInput } from '../types';
import type { UploadAsset } from '@/features/feed/types';

/**
 * Server-side search, 20 people per page. Pickers must pass the search term and
 * load more pages: the first page alone covers only the newest accounts.
 */
export function useDiscoverProfiles(search = '', enabled = true) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.discover, search],
    enabled,
    queryFn: ({ pageParam, signal }) => profileService.discoverPage(pageParam, search, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextSkip,
    // Keep showing the last results while a new search term loads, but never the
    // unfiltered list as if it were search results.
    placeholderData: (previous, previousQuery) =>
      search && !previousQuery?.queryKey[previousQuery.queryKey.length - 1] ? undefined : previous,
    select: (data) => {
      const seen = new Set<string>();
      return data.pages.flatMap((page) =>
        page.profiles.filter((profile) => !seen.has(profile.id) && seen.add(profile.id)),
      );
    },
  });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => profileService.get(userId, signal),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  return useMutation({
    mutationKey: ['profiles', 'updateMe'],
    mutationFn: (input: UpdateProfileInput) => profileService.updateMe(input),
    onSuccess: (user) => {
      updateUser(user);
      // Posts embed author details; refresh them so the new name shows everywhere.
      for (const queryKey of [queryKeys.feed, queryKeys.myPosts, ['user-posts']])
        void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateMyAvatar() {
  const queryClient = useQueryClient();
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  return useMutation({
    mutationKey: ['profiles', 'updateAvatar'],
    mutationFn: (asset: UploadAsset) => profileService.updateAvatar(asset),
    onSuccess: async () => {
      await refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.feed }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myPosts }),
        queryClient.invalidateQueries({ queryKey: ['user-posts'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.discover }),
      ]);
    },
  });
}
