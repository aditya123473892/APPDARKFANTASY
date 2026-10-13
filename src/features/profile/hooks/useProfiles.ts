import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { queryKeys } from '@/services/queryKeys';
import { profileService } from '../services';
import type { UpdateProfileInput } from '../types';

export function useDiscoverProfiles() {
  return useQuery({ queryKey: queryKeys.discover, queryFn: () => profileService.discover() });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => profileService.get(userId),
    enabled: Boolean(userId),
    retry: (count, error) => (error as { code?: string }).code !== 'NOT_FOUND' && count < 2,
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
