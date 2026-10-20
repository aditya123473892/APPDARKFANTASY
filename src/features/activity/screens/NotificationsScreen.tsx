import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Loader, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { toast } from '@/components/ui/Toast';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { NotificationRow } from '../components/NotificationRow';
import { useMarkNotificationsRead, useNotifications } from '../hooks/useActivity';

export function NotificationsScreen({ embedded = false }: { embedded?: boolean }) {
  const query = useNotifications();
  const read = useMarkNotificationsRead();
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <Screen padded={false} edges={embedded ? [] : ['left', 'right']}>
      <View style={{ paddingHorizontal: spacing.screen }}>
        {!embedded && <Header title="Activity" subtitle="Your notifications" align="left" />}
        <View style={styles.toolbar}>
          <Text variant="label" color="secondary" style={{ flex: 1 }}>
            {query.data?.unreadCount ? `${query.data.unreadCount} unread` : 'Notifications'}
          </Text>
          {query.data?.unreadCount ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              accessibilityState={{ disabled: read.isPending, busy: read.isPending }}
              style={({ pressed }) => [
                styles.readAction,
                pressed && { backgroundColor: theme.colors.primarySoft },
              ]}
              disabled={read.isPending}
              onPress={() =>
                read.mutate(undefined, {
                  onError: () => toast.error('Could not update notifications. Try again.'),
                })
              }
            >
              {read.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.primaryText} />
              ) : (
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color={theme.colors.primaryText}
                />
              )}
              <Text variant="caption" color="primary">
                Mark all read
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {query.isPending ? (
        <Loader />
      ) : query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data?.items ?? []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError)
              void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              message="New notifications will appear here."
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <Loader />
            ) : query.isFetchNextPageError ? (
              <Button
                label="Retry loading notifications"
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={(notification) => {
                if (!notification.read)
                  read.mutate([notification.id], {
                    onError: () => toast.error('Could not mark this notification read.'),
                  });
                if (notification.eventId) router.push(`/events/${notification.eventId}`);
              }}
            />
          )}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  readAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    flexShrink: 1,
  },
});
