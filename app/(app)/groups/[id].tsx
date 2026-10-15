import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Loader, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { groupService } from '@/features/chat/services/groupService';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { useCan, useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { displayName, type UserSummary } from '@/features/auth/userModel';
import { senderId } from '@/features/auth/userCache';
import { mediaUrl } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { useTheme } from '@/theme/useTheme';
export default function GroupMembers() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUserId();
  const canManage = useCan('canCreateGroups');
  const { theme } = useTheme();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => groupService.get(id),
    enabled: Boolean(id),
  });
  const directory = useDiscoverProfiles();
  const action = useMutation({
    mutationFn: ({ member, remove }: { member: string; remove?: boolean }) =>
      remove ? groupService.remove(id, member) : groupService.add(id, [member]),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['group-members', id] });
      void client.invalidateQueries({ queryKey: queryKeys.conversations });
    },
    onError: (error) => toast.error(describeError(error, 'Unable to update the group members.')),
  });
  const group = query.data;
  const memberIds = (group?.members ?? []).map(senderId);
  const owner = canManage && group?.admin === me;
  return (
    <Screen>
      <Header title={group?.name ?? 'Group members'} back backFallback="/chats" />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <Text variant="subheading">Members ({group?.members.length})</Text>
          {group?.members.map((value) => {
            const member: UserSummary = typeof value === 'string' ? { _id: value } : value;
            return (
              <View
                key={member._id}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Avatar uri={mediaUrl(member.avatar)} label={displayName(member)} />
                <Text style={{ flex: 1 }}>
                  {displayName(member)}
                  {member._id === group.admin ? ' · Owner' : ''}
                </Text>
                {owner && member._id !== group.admin ? (
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    disabled={action.isPending}
                    onPress={() => action.mutate({ member: member._id, remove: true })}
                  />
                ) : null}
              </View>
            );
          })}
          {owner ? (
            <>
              <Text variant="subheading">Add members</Text>
              <Input value={search} onChangeText={setSearch} placeholder="Search users" />
              {directory.isPending ? (
                <Loader />
              ) : directory.isError ? (
                <ErrorState onRetry={() => void directory.refetch()} />
              ) : (
                directory.data
                  ?.filter(
                    (u) =>
                      !memberIds.includes(u.id) &&
                      u.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((user) => (
                    <View
                      key={user.id}
                      style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
                    >
                      <Avatar uri={user.avatarUri} label={user.name} />
                      <Text style={{ flex: 1 }}>{user.name}</Text>
                      <Button
                        label="Add"
                        size="sm"
                        fullWidth={false}
                        disabled={action.isPending}
                        onPress={() => action.mutate({ member: user.id })}
                      />
                    </View>
                  ))
              )}
              {!directory.data?.some((u) => !memberIds.includes(u.id)) && (
                <EmptyState
                  compact
                  icon="people-outline"
                  title="Everyone is already in this group"
                  message="New backend users will appear after refreshing."
                />
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
