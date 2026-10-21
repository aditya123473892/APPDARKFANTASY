import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getData } from '@/services/api/backend';
import { queryClient } from '@/services/queryClient';

export type EntitlementStatus = {
  active: boolean; premiumUntil: string | null; serverTime: string;
  providerAvailable: boolean; imageUrlSeconds: number;
};
const imageQueryPrefixes = [['feed'], ['posts'], ['my-posts'], ['user-posts'], ['profiles'], ['bookmarks']] as const;

/** Remove stale unlocked results before refetching on an entitlement transition. */
export async function refreshPostImages(client: QueryClient): Promise<void> {
  await Promise.all(imageQueryPrefixes.map(async (queryKey) => {
    await client.cancelQueries({ queryKey });
    await client.resetQueries({ queryKey });
  }));
}

/** Future verified purchase/restore callbacks call this; no client entitlement writes. */
export async function refreshAfterSubscription(): Promise<void> {
  await refreshPostImages(queryClient);
  await queryClient.invalidateQueries({ queryKey: ['entitlements'] });
}

export function useEntitlementSync(): void {
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  const previous = useRef<string | null>(null);
  const status = useQuery({
    queryKey: ['entitlements', userId],
    queryFn: () => getData<EntitlementStatus>('/entitlements/me'),
    enabled: authenticated && !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: 'always',
  });
  useEffect(() => { previous.current = null; }, [userId]);
  useEffect(() => {
    const data = status.data;
    if (!data || !authenticated) return;
    const identity = `${userId}:${data.active}:${data.premiumUntil}`;
    if (previous.current !== null && previous.current !== identity) void refreshPostImages(queryClient);
    previous.current = identity;
    if (!data.active || !data.premiumUntil) return;
    // Schedule against server time rather than trusting the device's wall clock.
    const remaining = Date.parse(data.premiumUntil) - Date.parse(data.serverTime) - (Date.now() - status.dataUpdatedAt);
    if (!Number.isFinite(remaining)) return;
    const timer = setTimeout(() => {
      void refreshAfterSubscription();
    }, Math.min(2_147_483_647, Math.max(0, remaining)));
    return () => clearTimeout(timer);
  }, [authenticated, userId, status.data, status.dataUpdatedAt]);

  useEffect(() => {
    if (!authenticated) return;
    // Refresh already-mounted feeds/profiles before their signed image URLs expire.
    const seconds = status.data?.imageUrlSeconds ?? 900;
    const interval = setInterval(() => {
      for (const queryKey of imageQueryPrefixes) void queryClient.invalidateQueries({ queryKey });
    }, Math.max(30_000, (seconds - 60) * 1000));
    return () => clearInterval(interval);
  }, [authenticated, status.data?.imageUrlSeconds]);
}
