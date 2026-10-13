import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Skeleton, Tabs, Text } from '@/components/ui';
import { RequestCard } from '@/features/requests/components/RequestCard';
import { useRequestActions, useRequests } from '@/features/requests/hooks/useRequests';
import type { ConnectionRequest } from '@/features/requests/types';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { NotificationRow } from '../components/NotificationRow';
import { useMarkNotificationsRead, useNotifications } from '../hooks/useActivity';
import type { AppNotification } from '../types';

type Segment = 'Notifications' | 'Requests';
const SEGMENTS = ['Notifications', 'Requests'] as const;

function ListSkeleton({ tall = false }: { tall?: boolean }): React.JSX.Element {
  return (
    <View style={styles.skeleton}>
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} style={[styles.skeletonCard, tall && styles.skeletonTall]} />
      ))}
    </View>
  );
}

function NotificationsList(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, isPending, isError, isRefetching, isRefetchError, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.filter((item) => !item.read).length ?? 0;

  const open = useCallback(
    (item: AppNotification) => {
      if (!item.read) markRead.mutate([item.id]);
      if (item.kind === 'request') router.setParams({ tab: 'requests' });
      else if (item.conversationId) router.push(`/chat/${item.conversationId}`);
      else router.push(`/profile/${item.actor.id}`);
    },
    [markRead, router],
  );

  if (isPending) return <ListSkeleton />;
  if (isError && !data)
    return <ErrorState onRetry={() => void refetch()} message="We couldn't load your activity." />;
  return (
    <>
      {isRefetchError ? (
        <OfflineBanner message="Can't refresh right now. Showing saved activity." />
      ) : null}
      <SectionList
        sections={[
          { title: 'New', data: data.filter((item) => !item.read) },
          { title: 'Earlier', data: data.filter((item) => item.read) },
        ].filter((section) => section.data.length)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={data.length ? styles.list : styles.empty}
        stickySectionHeadersEnabled={false}
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
          unread ? (
            <View style={styles.listHeader}>
              <Text variant="caption" color="secondary">
                {unread} unread
              </Text>
              <Button
                label="Mark all as read"
                variant="ghost"
                size="sm"
                fullWidth={false}
                disabled={markRead.isPending}
                onPress={() => markRead.mutate(undefined)}
              />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" color="muted" style={styles.sectionTitle}>
            {section.title.toUpperCase()}
          </Text>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            message="Likes, requests and new connections will show up here."
          />
        }
        renderItem={({ item }) => <NotificationRow item={item} onPress={open} />}
      />
    </>
  );
}

function RequestsList(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, isPending, isError, isRefetching, isRefetchError, refetch } = useRequests();
  const { accept, decline, cancel, pendingId } = useRequestActions();

  const openProfile = useCallback(
    (request: ConnectionRequest) => router.push(`/profile/${request.user.id}`),
    [router],
  );
  const busy = Boolean(pendingId);
  const onAccept = useCallback((request: ConnectionRequest) => accept.mutate(request), [accept]);
  const onDecline = useCallback((request: ConnectionRequest) => decline.mutate(request), [decline]);
  const onCancel = useCallback((request: ConnectionRequest) => cancel.mutate(request), [cancel]);

  if (isPending) return <ListSkeleton tall />;
  if (isError && !data)
    return <ErrorState onRetry={() => void refetch()} message="We couldn't load your requests." />;

  const total = data.incoming.length + data.outgoing.length;
  return (
    <>
      {isRefetchError ? (
        <OfflineBanner message="Can't refresh right now. Showing saved requests." />
      ) : null}
      <SectionList
        sections={[
          {
            title: 'Received',
            subtitle: 'People who want to connect with you',
            data: data.incoming,
          },
          { title: 'Sent', subtitle: 'Waiting for a reply', data: data.outgoing },
        ].filter((section) => section.data.length)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={total ? styles.list : styles.empty}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surfaceElevated}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text variant="label" color="muted">
              {section.title.toUpperCase()} · {section.data.length}
            </Text>
            <Text variant="caption" color="muted">
              {section.subtitle}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No pending requests"
            message="Send a request from Discover. When someone accepts, you can start chatting right away."
            actionLabel="Discover people"
            onAction={() => router.push('/discover')}
          />
        }
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            busy={pendingId === item.id}
            disabled={busy && pendingId !== item.id}
            onOpenProfile={openProfile}
            onAccept={onAccept}
            onDecline={onDecline}
            onCancel={onCancel}
          />
        )}
      />
    </>
  );
}

export function ActivityScreen(): React.JSX.Element {
  const router = useRouter();
  // The segment lives in the URL (?tab=requests) so deep links and notification taps can target it.
  const params = useLocalSearchParams<{ tab?: string }>();
  const segment: Segment = params.tab === 'requests' ? 'Requests' : 'Notifications';
  const setSegment = (value: Segment) =>
    router.setParams({ tab: value === 'Requests' ? 'requests' : 'notifications' });
  const incoming = useRequests().data?.incoming.length ?? 0;
  const unread =
    useNotifications().data?.filter((item) => !item.read && item.kind !== 'request').length ?? 0;

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header title="Activity" align="left" />
        <Tabs
          variant="segmented"
          items={SEGMENTS}
          value={segment}
          counts={{ Notifications: unread, Requests: incoming }}
          onChange={setSegment}
        />
      </View>
      <View style={styles.body}>
        {segment === 'Notifications' ? <NotificationsList /> : <RequestsList />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md },
  body: { flex: 1 },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  empty: { flexGrow: 1 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.md, gap: 2 },
  gap: { height: spacing.sm },
  skeleton: { padding: spacing.screen, gap: spacing.md },
  skeletonCard: { height: 76, borderRadius: 20 },
  skeletonTall: { height: 180 },
});
