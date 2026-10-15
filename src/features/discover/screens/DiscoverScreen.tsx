import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Loader, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { useTheme } from '@/theme/useTheme';
import { describeError } from '@/services/errors';
export function DiscoverScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const query = useDiscoverProfiles();
  const users = (query.data ?? []).filter((u) =>
    u.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
        <Header title="People" align="left" />
        <Input
          accessibilityLabel="Search users"
          placeholder="Search by display name"
          icon="search-outline"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {query.isPending ? (
        <Loader />
      ) : query.isError && !query.data ? (
        <ErrorState
          title="Couldn't load people"
          message={describeError(query.error, "We couldn't load people. Please try again.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 20, flexGrow: 1, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No users found"
              message="Try another name or pull down to refresh."
            />
          }
          renderItem={({ item }) => (
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                gap: 12,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Pressable
                onPress={() => router.push(`/profile/${item.id}`)}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
              >
                <Avatar uri={item.avatarUri} label={item.name} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="subheading">{item.name}</Text>
                  {item.bio ? (
                    <Text numberOfLines={2} color="secondary">
                      {item.bio}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Button
                label="Message"
                size="sm"
                onPress={() => router.push(`/chat/user:${item.id}`)}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}
