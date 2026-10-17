import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, View } from 'react-native';
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
export function ActivityScreen() {
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
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.screen }}>
        <Header title="Likes" subtitle="People who want to know you" align="left" />
      </View>
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlashList
          data={query.data}
          keyExtractor={(f) => f._id}
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
              title="No pending follow requests"
              message="Requests from other users will appear here."
            />
          }
          renderItem={({ item }) => (
            <View
              style={{
                gap: 12,
                padding: 16,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                marginBottom: spacing.lg,
                backgroundColor: theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Avatar uri={mediaUrl(item.follower.avatar)} label={displayName(item.follower)} />
                <Text
                  serif
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/profile/${item.follower._id}`)}
                >
                  {displayName(item.follower)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button
                  label="Decline"
                  variant="secondary"
                  disabled={action.isPending}
                  style={{ flex: 1 }}
                  onPress={() => action.mutate({ id: item._id, status: 'rejected' })}
                />
                <Button
                  label="Accept"
                  disabled={action.isPending}
                  style={{ flex: 1 }}
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
