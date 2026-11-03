import { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Avatar, EmptyState, Loader, SearchField, Text } from '@/components/ui';
import { Pressable } from '@/components/ui/Pressable';
import { ErrorState } from '@/components/feedback/ErrorState';
import type { ProfileView } from '@/features/profile/types';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { useDebounce } from '@/hooks/useDebounce';
import { describeError } from '@/services/errors';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const ResultRow = memo(function ResultRow({
  profile,
  showPresence,
  onOpen,
}: {
  profile: ProfileView;
  showPresence: boolean;
  onOpen: (profile: ProfileView) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const meta = [profile.age > 0 ? String(profile.age) : null, profile.location]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${profile.name}'s profile`}
      onPress={() => onOpen(profile)}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfacePressed },
      ]}
    >
      <Avatar
        uri={profile.avatarThumbUri || profile.avatarUri}
        label={profile.name}
        size={44}
        online={showPresence && Boolean(profile.presence?.online)}
      />
      <View style={styles.copy}>
        <Text weight="semibold" numberOfLines={1}>
          {profile.name}
        </Text>
        {meta ? (
          <Text variant="caption" color="muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

/** Find someone by display name: one search box and a compact list of people. */
export function SearchScreen(): React.JSX.Element {
  const router = useRouter();
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const [search, setSearch] = useState('');
  const needle = useDebounce(search.trim(), 250);
  const query = useDiscoverProfiles(needle, Boolean(needle));
  const onOpen = useCallback(
    (profile: ProfileView) => router.push(`/profile/${profile.id}`),
    [router],
  );
  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header
          title="Search"
          back
          backFallback="/home"
          content={
            <SearchField
              autoFocus
              accessibilityLabel="Search people"
              placeholder="Search people"
              value={search}
              onChangeText={setSearch}
            />
          }
        />
      </View>
      {!needle ? (
        <EmptyState
          icon="search-outline"
          title="Find people"
          message="Search by display name."
        />
      ) : query.isPending ? (
        <Loader label="Searching" />
      ) : query.isError && !query.data ? (
        <ErrorState
          title="Couldn't search"
          message={describeError(query.error, "We couldn't search right now. Please try again.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <FlashList
          data={query.data ?? []}
          keyExtractor={(profile) => profile.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
              void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={query.isFetchingNextPage ? <Loader /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No one found"
              message="Try another name."
              actionLabel="Clear search"
              onAction={() => setSearch('')}
            />
          }
          renderItem={({ item }) => (
            <ResultRow profile={item} showPresence={showPresence} onOpen={onOpen} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.md },
  list: { paddingBottom: spacing.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
});
