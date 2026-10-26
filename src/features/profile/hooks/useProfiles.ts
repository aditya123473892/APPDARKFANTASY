import {
  keepPreviousData,
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
export function useDiscoverProfiles(search = '') {
  return useInfiniteQuery({
    queryKey: [...queryKeys.discover, search],
    queryFn: ({ pageParam }) => profileService.discoverPage(pageParam, search),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextSkip,
    // Keep showing the last results while a new search term loads.
    placeholderData: keepPreviousData,
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
    queryFn: () => profileService.get(userId),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed });
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
        queryClient.invalidateQueries({ queryKey: queryKeys.discover }),
      ]);
    },
  });
}
