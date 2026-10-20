import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { spacing, radius } from '@/theme';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, Text, EmptyState, Loader } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { pendingFollows, approveFollow } from '@/features/requests/services/requestsService.real';
import { queryKeys } from '@/services/queryKeys';
import { describeError } from '@/services/errors';
import { useTheme } from '@/theme/useTheme';
import { displayName } from '@/features/auth/userModel';
import { mediaUrl } from '@/services/api/backend';
import { useState } from 'react';
import { NotificationsScreen } from './NotificationsScreen';
export function ActivityScreen() {
  const [tab, setTab] = useState<'notifications' | 'requests'>('notifications');
  const { theme } = useTheme();
  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <View style={styles.heading}>
        <Header title="Activity" subtitle="Stay connected with your circle" align="left" />
      </View>
      <View style={styles.tabArea}>
        <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
          {(['notifications', 'requests'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={({ pressed }) => [
                styles.tab,
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <View style={styles.tabLabel}>
                <Ionicons
                  name={value === 'notifications' ? 'notifications-outline' : 'people-outline'}
                  size={18}
                  color={tab === value ? theme.colors.primaryText : theme.colors.textMuted}
                />
                <Text
                  variant="label"
                  weight="semibold"
                  center
                  style={{
                    color: tab === value ? theme.colors.primaryText : theme.colors.textSecondary,
                  }}
                >
                  {value === 'notifications' ? 'Notifications' : 'Requests'}
                </Text>
              </View>
              {tab === value && (
                <View style={[styles.indicator, { backgroundColor: theme.colors.primary }]} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
      {tab === 'notifications' ? <NotificationsScreen embedded /> : <FollowRequestsScreen />}
    </Screen>
  );
}
function FollowRequestsScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const { theme } = useTheme();
  const query = useQuery({ queryKey: ['follow-requests'], queryFn: pendingFollows });
  const action = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'rejected' }) =>
      approveFollow(id, status),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['follow-requests'] });
      void client.invalidateQueries({ queryKey: queryKeys.requests });
    },
    onError: (error) => toast.error(describeError(error, 'Unable to update this follow request.')),
  });
  return (
    <Screen padded={false} edges={[]}>
      <View style={styles.sectionHeading}>
        <Text variant="label" color="secondary">
          Follow requests
        </Text>
        <Text variant="caption" color="muted">
          Review who can follow you
        </Text>
      </View>
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data}
          keyExtractor={(f) => f._id}
          contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
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
              title="No pending follow requests"
              message="Requests from other users will appear here."
            />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.requestCard,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${displayName(item.follower)}'s profile`}
                onPress={() => router.push(`/profile/${item.follower._id}`)}
                style={styles.person}
              >
                <Avatar uri={mediaUrl(item.follower.avatar)} label={displayName(item.follower)} />
                <View style={styles.personCopy}>
                  <Text variant="label" weight="semibold">
                    {displayName(item.follower)}
                  </Text>
                  <Text variant="caption" color="muted">
                    Wants to follow you
                  </Text>
                </View>
              </Pressable>
              <View style={styles.requestActions}>
                <Button
                  label="Decline"
                  fullWidth={false}
                  variant="ghost"
                  size="sm"
                  disabled={action.isPending}
                  style={styles.requestAction}
                  onPress={() => action.mutate({ id: item._id, status: 'rejected' })}
                />
                <Button
                  label="Accept"
                  icon="checkmark"
                  size="sm"
                  fullWidth={false}
                  disabled={action.isPending}
                  loading={
                    action.isPending &&
                    action.variables?.id === item._id &&
                    action.variables.status === 'accepted'
                  }
                  style={styles.requestAction}
                  onPress={() => action.mutate({ id: item._id, status: 'accepted' })}
                />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.md },
  tabArea: { paddingHorizontal: spacing.screen },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  tabLabel: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  sectionHeading: { padding: spacing.screen, gap: spacing.xs },
  requestCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  person: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: 48 },
  personCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  requestAction: { minWidth: 96, minHeight: 44 },
});
