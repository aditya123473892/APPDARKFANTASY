import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Loader, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Pressable } from '@/components/ui/Pressable';
import { getData } from '@/services/api/backend';
import type { User } from '@/features/auth/userModel';
import { FollowButton } from '@/features/requests/components/FollowButton';
import { mapProfile } from '../services/profileService.real';
import { spacing } from '@/theme';

export function ConnectionsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(params.tab === 'following' ? 'following' : 'followers');
  const router = useRouter();
  const query = useQuery({ queryKey: ['social-lists', tab, 'profiles'], queryFn: async ({ signal }) => {
    const data = await getData<Record<string, User[]>>('/users/follow/' + tab, undefined, signal);
    if (!Array.isArray(data[tab])) throw new Error('Relationship list unavailable');
    return data[tab]!.map(mapProfile);
  } });
  return <Screen padded={false}><Header title="Connections" back backFallback="/profile" />
    <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}>
      <Button label="Followers" size="sm" fullWidth={false} style={{ flex: 1 }} variant={tab === 'followers' ? 'primary' : 'secondary'} onPress={() => setTab('followers')} />
      <Button label="Following" size="sm" fullWidth={false} style={{ flex: 1 }} variant={tab === 'following' ? 'primary' : 'secondary'} onPress={() => setTab('following')} />
    </View>
    {query.isPending ? <Loader /> : query.isError ? <ErrorState onRetry={() => void query.refetch()} /> :
      <FlashList data={query.data} keyExtractor={user => user.id} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}
        ListEmptyComponent={<EmptyState title={tab === 'followers' ? 'No followers yet' : 'You are not following anyone yet'} message="Your connections will appear here." />}
        renderItem={({ item }) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }} onPress={() => router.push(`/profile/${item.id}`)} accessibilityLabel={`Open ${item.name}'s profile`}>
            <Avatar uri={item.avatarUri} label={item.name} size={42} /><Text numberOfLines={1}>{item.name}</Text>
          </Pressable><FollowButton userId={item.id} />
        </View>} />}
  </Screen>;
}
