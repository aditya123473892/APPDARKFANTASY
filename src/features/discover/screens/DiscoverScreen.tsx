import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { ProfileView } from '@/features/profile/types';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Loader, SearchField, Skeleton } from '@/components/ui';
import { ProfilePost } from '../components/ProfilePost';
import { radius, spacing } from '@/theme';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { useTheme } from '@/theme/useTheme';
import { describeError } from '@/services/errors';
import { useDebounce } from '@/hooks/useDebounce';

const NO_INTERESTS: string[] = [];

function DiscoverSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeleton}>
      {[0, 1].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <Skeleton style={styles.skeletonName} />
            <Skeleton style={styles.skeletonMeta} />
            <Skeleton style={styles.skeletonPhoto} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Vertical, feed-style discovery. No swiping: every action is an explicit button. */
export function DiscoverScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const showDistance = usePreferences((state) => state.showDistance);
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const myInterests = useAuthStore((state) => state.user?.interests) ?? NO_INTERESTS;
  const [search, setSearch] = useState('');
  const needle = useDebounce(search.trim(), 250);
  const query = useDiscoverProfiles(needle);
  const users = query.data ?? [];
  const onOpen = useCallback(
    (profile: ProfileView) => router.push(`/profile/${profile.id}`),
    [router],
  );
  const onMessage = useCallback(
    (profile: ProfileView) => router.push(`/chat/user:${profile.id}`),
    [router],
  );
  return (
    <Screen padded={false}>
      <View style={[styles.top, { borderBottomColor: theme.colors.divider }]}>
        <Header title="Discover" back backFallback="/profile" />
        <SearchField
          accessibilityLabel="Search users"
          placeholder="Search by display name"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {query.isPending ? (
        <DiscoverSkeleton />
      ) : query.isError && !query.data ? (
        <ErrorState
          title="Couldn't load people"
          message={describeError(query.error, "We couldn't load people. Please try again.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <FlashList
          data={users}
          keyExtractor={(u) => u.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
              void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <Loader label="Loading more people" />
            ) : query.isFetchNextPageError ? (
              <Button
                label="Try loading more people again"
                onPress={() => void query.fetchNextPage()}
              />
            ) : query.hasNextPage ? (
              <Button label="Load more people" onPress={() => void query.fetchNextPage()} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surfaceElevated}
            />
          }
          ListEmptyComponent={
            needle ? (
              <EmptyState
                icon="search-outline"
                title="No matches"
                message="Try another name, or clear the search."
                actionLabel="Clear search"
                onAction={() => setSearch('')}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No one here yet"
                message="New people join every day. Pull down to refresh."
              />
            )
          }
          renderItem={({ item }) => (
            <ProfilePost
              profile={item}
              sharedInterests={myInterests}
              showDistance={showDistance}
              showPresence={showPresence}
              onOpen={onOpen}
              onMessage={onMessage}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  skeleton: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, gap: spacing.xl },
  skeletonRow: { flexDirection: 'row', gap: spacing.md },
  skeletonAvatar: { width: 42, height: 42, borderRadius: radius.full },
  skeletonCopy: { flex: 1, gap: spacing.sm },
  skeletonName: { width: '40%' },
  skeletonMeta: { width: '25%', height: 12 },
  skeletonPhoto: { height: 260, borderRadius: radius.md, marginTop: spacing.xs },
});
