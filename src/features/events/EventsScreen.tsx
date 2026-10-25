import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, Screen, SettingsButton } from '@/components/layout';
import { Button, Chip, EmptyState, IconButton, Loader, SearchField, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { mediaUrl } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import { spacing, radius } from '@/theme';
import { useContentInsets } from '@/components/layout/useContentInsets';
import { useTheme } from '@/theme/useTheme';
import { useEvents } from './hooks';
import { EventCover } from './EventCover';

export const eventTime = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Time unavailable';

export function EventsScreen() {
  const router = useRouter();
  const contentInsets = useContentInsets();
  const { theme } = useTheme();
  const admin = useCan('canViewAdminScreens');
  const query = useEvents();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const events = (query.data ?? [])
    .filter((event) =>
      `${event.name} ${event.theme ?? ''} ${event.location ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    .filter((event) => {
      if (filter === 'All') return true;
      const now = new Date();
      const start = new Date(event.startAt);
      if (filter === 'Today') return start.toDateString() === now.toDateString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return start >= weekStart && start < weekEnd;
    });
  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header
          title="Events"
          action={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {admin ? (
                <IconButton
                  icon="add"
                  label="Create event"
                  onPress={() => router.push('/events/new')}
                />
              ) : null}
              <SettingsButton />
            </View>
          }
        />
        <SearchField
          accessibilityLabel="Search events"
          placeholder="Search events, themes or places"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filters}>
          {['All', 'Today', 'This Week'].map((value) => (
            <Chip
              key={value}
              label={value}
              selected={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </View>
      </View>
      {query.isPending ? (
        <Loader />
      ) : query.isError && !query.data ? (
        <ErrorState
          title="Couldn't load events"
          message={describeError(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[styles.list, { paddingBottom: contentInsets.bottom }]}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          ListHeaderComponent={
            query.isError ? (
              <Text color="danger">Could not refresh events. Pull down to try again.</Text>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={search ? 'No matching events' : 'No events yet'}
              message={
                search
                  ? 'Try another name or theme.'
                  : 'New gatherings will appear here. Pull down to refresh.'
              }
            />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <EventCover
                uri={mediaUrl(item.cover?.url)}
                hasCover={Boolean(item.cover)}
                label={`${item.name} cover`}
                onRetry={query.refetch}
              />
              <Text variant="heading" numberOfLines={2}>
                {item.name}
              </Text>
              <Text color="secondary">{eventTime(item.startAt)}</Text>
              {item.location ? (
                <Text color="muted" numberOfLines={2}>
                  {item.location}
                </Text>
              ) : null}
              <Button
                label="View & RSVP"
                icon="arrow-forward"
                style={{ marginTop: spacing.sm }}
                variant="secondary"
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: item._id } })}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screen, gap: spacing.sm, paddingBottom: spacing.md },
  list: { padding: spacing.screen, gap: spacing.lg, paddingBottom: spacing.xxxl },
  filters: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
