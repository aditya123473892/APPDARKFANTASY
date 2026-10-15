import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Loader, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ProtectedRoute } from '@/features/auth/components/Access';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { groupService } from '@/features/chat/services/groupService';
import { queryKeys } from '@/services/queryKeys';
import { describeError } from '@/services/errors';
import { useTheme } from '@/theme/useTheme';
function NewGroup() {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const users = useDiscoverProfiles();
  const { theme } = useTheme();
  const client = useQueryClient();
  const router = useRouter();
  const create = useMutation({
    mutationFn: () => groupService.create(name, selected),
    onSuccess: (group) => {
      void client.invalidateQueries({ queryKey: queryKeys.conversations });
      router.replace(`/chat/group:${group._id}`);
    },
    onError: (error) => toast.error(describeError(error, 'Unable to create the group.')),
  });
  return (
    <Screen padded={false}>
      <View style={{ padding: 20, gap: 12 }}>
        <Header title="New group" back backFallback="/chats" />
        <Input label="Group name" value={name} onChangeText={setName} maxLength={100} />
        <Input
          accessibilityLabel="Search members"
          placeholder="Search real users"
          value={search}
          onChangeText={setSearch}
        />
        <Text variant="caption" color="secondary">
          {selected.length} selected. You are included as the group owner.
        </Text>
      </View>
      {users.isPending ? (
        <Loader />
      ) : users.isError ? (
        <ErrorState onRetry={() => void users.refetch()} />
      ) : (
        <FlatList
          data={users.data?.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 20 }}
          ListEmptyComponent={
            <EmptyState
              compact
              icon="people-outline"
              title="No users found"
              message="Pull down to refresh the user list."
            />
          }
          onRefresh={() => void users.refetch()}
          refreshing={users.isRefetching}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(item.id) }}
              disabled={create.isPending}
              onPress={() =>
                setSelected((ids) =>
                  ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id],
                )
              }
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                padding: 12,
                borderRadius: 12,
                backgroundColor: selected.includes(item.id)
                  ? theme.colors.primarySoft
                  : theme.colors.surface,
              }}
            >
              <Avatar uri={item.avatarUri} label={item.name} />
              <Text style={{ flex: 1 }}>{item.name}</Text>
              <Text>{selected.includes(item.id) ? '✓' : '+'}</Text>
            </Pressable>
          )}
        />
      )}
      <View style={{ padding: 20 }}>
        <Button
          label="Create group"
          loading={create.isPending}
          disabled={!name.trim() || !selected.length || create.isPending || users.isError}
          onPress={() => create.mutate()}
        />
      </View>
    </Screen>
  );
}
export default function NewGroupRoute() {
  return (
    <ProtectedRoute capability="canCreateGroups">
      <NewGroup />
    </ProtectedRoute>
  );
}
