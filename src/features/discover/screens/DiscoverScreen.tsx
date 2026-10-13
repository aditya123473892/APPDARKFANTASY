import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { Header, Screen } from '@/components/layout';
import { EmptyState, IconButton, Input, Skeleton, Tabs } from '@/components/ui';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import type { ProfileView } from '@/features/profile/types';
import { useSendRequest } from '@/features/requests/hooks/useRequests';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { useDebounce } from '@/hooks/useDebounce';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { ActionButtons } from '../components/ActionButtons';
import { CardStack, type CardStackHandle, type SwipeAction } from '../components/CardStack';
import { FilterSheet } from '../components/FilterSheet';
import { ProfileCard } from '../components/ProfileCard';

type Mode = 'Browse' | 'Swipe';
const GAP = spacing.md;

export function DiscoverScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('Browse');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const query = useDebounce(search.trim().toLowerCase(), 200);
  const stack = useRef<CardStackHandle>(null);
  const showDistance = usePreferences((state) => state.showDistance);
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const { data, isPending, isError, isRefetching, isRefetchError, refetch } = useDiscoverProfiles();
  const sendRequest = useSendRequest();

  // Responsive grid: 2 columns on phones, more on tablets / unfolded foldables / landscape.
  const contentWidth = Math.min(width, spacing.contentMax);
  const columns = contentWidth >= 600 ? 3 : 2;
  const cardWidth = Math.floor((contentWidth - spacing.screen * 2 - GAP * (columns - 1)) / columns);

  const allInterests = useMemo(
    () => [...new Set((data ?? []).flatMap((profile) => profile.interests))].sort(),
    [data],
  );
  const profiles = useMemo(
    () =>
      (data ?? []).filter(
        (profile) =>
          (!filters.length || profile.interests.some((interest) => filters.includes(interest))) &&
          (!query ||
            `${profile.name} ${profile.bio} ${profile.interests.join(' ')}`
              .toLowerCase()
              .includes(query)),
      ),
    [data, filters, query],
  );

  const swipeProfiles = useMemo(
    () => profiles.filter((profile) => profile.relationship.status !== 'outgoing'),
    [profiles],
  );

  const pendingUserId = sendRequest.isPending ? sendRequest.variables?.userId : undefined;
  const connect = useCallback(
    (profile: ProfileView, superLike = false) => {
      const { relationship } = profile;
      if (relationship.status === 'connected') {
        router.push(`/chat/${relationship.conversationId}`);
        return;
      }
      // Never fire a duplicate request for someone already requested or currently being requested.
      if (relationship.status === 'outgoing' || pendingUserId === profile.id) return;
      sendRequest.mutate({ userId: profile.id, name: profile.name, superLike });
    },
    [pendingUserId, router, sendRequest],
  );
  const openProfile = useCallback(
    (profile: ProfileView) => router.push(`/profile/${profile.id}`),
    [router],
  );
  const onSwipe = useCallback(
    (profile: ProfileView, action: SwipeAction) => {
      if (action !== 'pass') connect(profile, action === 'super');
    },
    [connect],
  );

  const header = (
    <View style={styles.top}>
      <Header
        title="Discover"
        align="left"
        action={
          <IconButton
            icon="options-outline"
            label={filters.length ? `Filters, ${filters.length} active` : 'Filters'}
            dot={filters.length > 0}
            onPress={() => setFilterOpen(true)}
          />
        }
      />
      <Tabs
        variant="segmented"
        items={['Browse', 'Swipe'] as const}
        value={mode}
        onChange={setMode}
      />
    </View>
  );

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <View style={[styles.grid, styles.skeletonGrid]}>
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} style={{ width: cardWidth, aspectRatio: 0.68, borderRadius: 20 }} />
        ))}
      </View>
    );
  } else if (isError && !data) {
    body = (
      <ErrorState onRetry={() => void refetch()} message="We couldn't load new people right now." />
    );
  } else if (mode === 'Browse') {
    body = (
      <FlatList
        key={`grid-${columns}`}
        data={profiles}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.grid, !profiles.length && styles.empty]}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surfaceElevated}
          />
        }
        ListHeaderComponent={
          <View style={styles.search}>
            <Input
              accessibilityLabel="Search people"
              icon="search-outline"
              placeholder="Search names, interests…"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
        }
        ListEmptyComponent={
          query || filters.length ? (
            <EmptyState
              icon="search-outline"
              title="No one matches that"
              message="Try a broader search or fewer interests."
              actionLabel="Clear search & filters"
              onAction={() => {
                setSearch('');
                setFilters([]);
              }}
            />
          ) : (
            <EmptyState
              icon="moon-outline"
              title="You've met everyone nearby"
              message="New people join every day. Pull down to refresh."
            />
          )
        }
        renderItem={({ item }) => (
          <ProfileCard
            profile={item}
            width={cardWidth}
            showDistance={showDistance}
            pending={pendingUserId === item.id}
            onOpen={openProfile}
            onAction={connect}
          />
        )}
      />
    );
  } else {
    body = (
      <View style={styles.swipe}>
        <View style={styles.stack}>
          <CardStack
            ref={stack}
            profiles={swipeProfiles}
            showDistance={showDistance}
            showPresence={showPresence}
            onSwipe={onSwipe}
            onEmptyAction={() => setMode('Browse')}
          />
        </View>
        <ActionButtons
          onAction={(action) => stack.current?.act(action)}
          disabled={!swipeProfiles.length}
        />
      </View>
    );
  }

  return (
    <Screen padded={false}>
      {header}
      {isRefetchError && data ? (
        <OfflineBanner message="Can't refresh right now. Showing saved profiles." />
      ) : null}
      <View style={styles.body}>{body}</View>
      <FilterSheet
        visible={filterOpen}
        interests={allInterests}
        selected={filters}
        onApply={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  body: { flex: 1 },
  search: { paddingBottom: spacing.md },
  grid: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: GAP,
  },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  column: { gap: GAP },
  empty: { flexGrow: 1 },
  swipe: { flex: 1, paddingHorizontal: spacing.screen },
  stack: { flex: 1, marginTop: spacing.sm, maxHeight: 640 },
});
