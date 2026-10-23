import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Loader, SearchField, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { mediaUrl } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import { spacing, radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useEvents } from './hooks';

export const eventTime = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Time unavailable';

export function EventsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const admin = useCan('canViewAdminScreens');
  const query = useEvents();
  const [search, setSearch] = useState('');
  const events = (query.data ?? []).filter((event) =>
    `${event.name} ${event.theme ?? ''} ${event.location ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header title="Events" subtitle="Find your next gathering" align="left" />
        {admin && (
          <Button
            label="Create event"
            icon="add"
            size="sm"
            fullWidth={false}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => router.push('/events/new')}
          />
        )}
        <SearchField
          accessibilityLabel="Search events"
          placeholder="Search events, themes or places"
          value={search}
          onChangeText={setSearch}
        />
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
          contentContainerStyle={styles.list}
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
              {mediaUrl(item.cover?.url) ? (
                <Image
                  source={{ uri: mediaUrl(item.cover?.url) }}
                  style={styles.cover}
                  contentFit="cover"
                  accessibilityLabel={`${item.name} cover`}
                />
              ) : null}
              <Text color="primary" variant="caption">
                {item.type === 'online' ? 'ONLINE' : 'IN PERSON'} · {item.status}
              </Text>
              <Text variant="heading">{item.name}</Text>
              {item.theme ? <Text color="secondary">{item.theme}</Text> : null}
              <Text color="secondary">{eventTime(item.startAt)}</Text>
              {item.location ? (
                <Text color="muted" numberOfLines={2}>
                  {item.location}
                </Text>
              ) : null}
              <Text numberOfLines={3}>{item.description}</Text>
              <Button
                label="View event"
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
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  cover: { width: '100%', height: 180, borderRadius: radius.md },
});
