import { useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { ProfileView } from '@/features/profile/types';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Input, Loader } from '@/components/ui';
import { SwipeCard } from '../components/SwipeCard';
import { ActionButtons } from '../components/ActionButtons';
import { spacing } from '@/theme';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { useTheme } from '@/theme/useTheme';
import { describeError } from '@/services/errors';
export function DiscoverScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const showDistance = usePreferences((state) => state.showDistance);
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const [search, setSearch] = useState('');
  const list = useRef<FlashListRef<ProfileView>>(null);
  const query = useDiscoverProfiles();
  const users = (query.data ?? []).filter((u) =>
    u.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Screen padded={false}>
      <View
        style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.lg, gap: spacing.sm }}
      >
        <Header title="Discover" subtitle="A connection worth finding" align="left" />
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
        <FlashList
          ref={list}
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.screen }}
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
          renderItem={({ item, index }) => (
            <View
              style={{
                marginBottom: spacing.xl,
                gap: spacing.md,
              }}
            >
              <View style={{ height: 440 }}>
                <SwipeCard
                  profile={item}
                  showDistance={showDistance}
                  showPresence={showPresence}
                  onPass={
                    users.length > 1
                      ? () => {
                          void list.current?.scrollToIndex({
                            index: (index + 1) % users.length,
                            animated: true,
                          });
                        }
                      : undefined
                  }
                />
              </View>
              <ActionButtons
                unavailableActions={['like', 'super']}
                onAction={(action) => {
                  if (action === 'pass' && users.length > 1)
                    void list.current?.scrollToIndex({
                      index: (index + 1) % users.length,
                      animated: true,
                    });
                }}
                disabled={users.length < 2}
              />
              <Button
                label="View profile"
                variant="secondary"
                onPress={() => router.push(`/profile/${item.id}`)}
              />
              <Button
                label="Message"
                icon="chatbubble-outline"
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
