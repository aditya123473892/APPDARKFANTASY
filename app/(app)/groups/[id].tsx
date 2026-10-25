import { cleanupPickedAssets } from '@/services/api/photoUpload';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Header, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Loader, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_MEMBERS_MAX,
  GROUP_NAME_MAX,
  groupService,
} from '@/features/chat/services/groupService';
import { acceptGroupRemoved } from '@/features/chat/services/chatState';
import { pickImage } from '@/features/create-post/pickMedia';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { displayName, type UserSummary } from '@/features/auth/userModel';
import { senderId } from '@/features/auth/userCache';
import { useDebounce } from '@/hooks/useDebounce';
import { mediaUrl } from '@/services/api/backend';
import { describeError, isServiceError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const confirm = (title: string, message: string, action: string, onConfirm: () => void) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);

export default function GroupInfo(): React.JSX.Element {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useCurrentUserId();
  const { theme } = useTheme();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const query = useDebounce(search.trim().toLowerCase(), 150);

  const group = useQuery({
    queryKey: queryKeys.group(id),
    queryFn: () => groupService.get(id),
    enabled: Boolean(id),
    retry: false,
  });
  const data = group.data;
  const owner = Boolean(data && me && String(data.admin) === me);
  const members = useMemo(
    () =>
      (data?.members ?? []).map((value): UserSummary =>
        typeof value === 'string' ? { _id: value } : value,
      ),
    [data?.members],
  );
  const memberIds = useMemo(() => new Set(members.map((member) => senderId(member))), [members]);
  const directory = useDiscoverProfiles();
  const candidates = useMemo(
    () =>
      (directory.data ?? []).filter(
        (user) => !memberIds.has(user.id) && (!query || user.name.toLowerCase().includes(query)),
      ),
    [directory.data, memberIds, query],
  );

  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.group(id) });
    void client.invalidateQueries({ queryKey: queryKeys.conversations });
    void client.invalidateQueries({ queryKey: queryKeys.conversation(`group:${id}`) });
  };
  const onError = (fallback: string) => (error: unknown) =>
    toast.error(describeError(error, fallback));

  const membership = useMutation({
    mutationFn: ({ member, remove }: { member: string; remove?: boolean }) =>
      remove ? groupService.remove(id, member) : groupService.add(id, [member]),
    onSuccess: refresh,
    onError: onError("We couldn't update the members."),
  });
  const details = useMutation({
    mutationFn: () => groupService.update(id, { name, description }),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError: onError("We couldn't save the group details."),
  });
  const photo = useMutation({
    mutationFn: async () => {
      const asset = await pickImage();
      if (!asset) return null;
      try {
        return await groupService.uploadIcon(id, asset);
      } finally {
        await cleanupPickedAssets([asset]);
      }
    },
    onSuccess: (result) => {
      if (result) refresh();
    },
    onError: onError("We couldn't upload that photo."),
  });
  const exit = useMutation({
    mutationFn: (mode: 'leave' | 'delete') =>
      mode === 'delete' ? groupService.delete(id) : groupService.leave(id),
    onSuccess: (_result, mode) => {
      acceptGroupRemoved({ groupId: id });
      toast.success(mode === 'delete' ? 'Group deleted' : 'You left the group');
      router.replace('/chats');
    },
    onError: onError("We couldn't complete that. Please try again."),
  });
  const busy = membership.isPending || details.isPending || photo.isPending || exit.isPending;

  if (group.isPending) {
    return (
      <Screen>
        <Header title="Group info" back backFallback="/chats" />
        <Loader />
      </Screen>
    );
  }
  if (group.isError || !data) {
    const gone =
      isServiceError(group.error, 'NOT_FOUND') || isServiceError(group.error, 'FORBIDDEN');
    return (
      <Screen>
        <Header title="Group info" back backFallback="/chats" />
        {gone ? (
          <EmptyState
            icon="people-outline"
            title="Group not available"
            message="It may have been deleted, or you're no longer a member."
            actionLabel="Back to messages"
            onAction={() => router.replace('/chats')}
          />
        ) : (
          <ErrorState onRetry={() => void group.refetch()} message="We couldn't load this group." />
        )}
      </Screen>
    );
  }

  const full = members.length >= GROUP_MEMBERS_MAX;
  return (
    <Screen>
      <Header title="Group info" back backFallback="/chats" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change group photo"
            disabled={!owner || busy}
            onPress={() => photo.mutate()}
          >
            <Avatar uri={mediaUrl(data.groupIcon)} label={data.name} size={96} />
          </Pressable>
          {owner ? (
            <Text variant="caption" color="primary">
              {photo.isPending ? 'Uploading…' : 'Tap the photo to change it'}
            </Text>
          ) : null}
          {editing ? (
            <View style={styles.editor}>
              <Input
                label="Group name"
                value={name}
                onChangeText={setName}
                maxLength={GROUP_NAME_MAX}
                error={!name.trim() ? 'Give the group a name.' : undefined}
              />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                maxLength={GROUP_DESCRIPTION_MAX}
                multiline
                showCount
              />
              <View style={styles.buttons}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="sm"
                  disabled={details.isPending}
                  onPress={() => setEditing(false)}
                  style={styles.button}
                />
                <Button
                  label="Save"
                  size="sm"
                  loading={details.isPending}
                  disabled={!name.trim() || details.isPending}
                  onPress={() => details.mutate()}
                  style={styles.button}
                />
              </View>
            </View>
          ) : (
            <>
              <Text variant="heading" style={styles.center}>
                {data.name}
              </Text>
              {data.description ? (
                <Text color="secondary" style={styles.center}>
                  {data.description}
                </Text>
              ) : null}
              <Text variant="caption" color="muted">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
              {owner ? (
                <Button
                  label="Edit details"
                  icon="create-outline"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  disabled={busy}
                  onPress={() => {
                    setName(data.name);
                    setDescription(data.description ?? '');
                    setEditing(true);
                  }}
                />
              ) : (
                <Button
                  label="Report group"
                  icon="flag-outline"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() =>
                    router.push({
                      pathname: '/report' as never,
                      params: { targetType: 'group', targetId: id },
                    })
                  }
                />
              )}
            </>
          )}
        </View>

        <Text variant="subheading">Members</Text>
        {members.map((member) => {
          const memberId = senderId(member);
          const isOwner = memberId === String(data.admin);
          return (
            <View key={memberId} style={[styles.row, { backgroundColor: theme.colors.surface }]}>
              <Avatar uri={mediaUrl(member.avatar)} label={displayName(member)} />
              <View style={styles.rowCopy}>
                <Text numberOfLines={1}>
                  {displayName(member)}
                  {memberId === me ? ' (you)' : ''}
                </Text>
                {isOwner ? (
                  <Text variant="caption" color="primary">
                    Owner
                  </Text>
                ) : null}
              </View>
              {owner && !isOwner ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  disabled={busy}
                  accessibilityLabel={`Remove ${displayName(member)}`}
                  onPress={() =>
                    confirm(
                      `Remove ${displayName(member)}?`,
                      'They will stop receiving messages from this group.',
                      'Remove',
                      () => membership.mutate({ member: memberId, remove: true }),
                    )
                  }
                />
              ) : null}
            </View>
          );
        })}

        {owner ? (
          <View style={styles.section}>
            <Text variant="subheading">Add members</Text>
            {full ? (
              <Text color="secondary">This group has reached {GROUP_MEMBERS_MAX} members.</Text>
            ) : (
              <>
                <Input
                  accessibilityLabel="Search people to add"
                  icon="search-outline"
                  placeholder="Search people"
                  value={search}
                  onChangeText={setSearch}
                />
                {directory.isPending ? (
                  <Loader />
                ) : directory.isError ? (
                  <ErrorState onRetry={() => void directory.refetch()} />
                ) : candidates.length ? (
                  candidates.slice(0, 50).map((user) => (
                    <View key={user.id} style={styles.candidate}>
                      <Avatar uri={user.avatarUri} label={user.name} />
                      <Text style={styles.rowCopy} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Button
                        label="Add"
                        size="sm"
                        fullWidth={false}
                        disabled={busy}
                        accessibilityLabel={`Add ${user.name}`}
                        onPress={() => membership.mutate({ member: user.id })}
                      />
                    </View>
                  ))
                ) : (
                  <EmptyState
                    compact
                    icon="people-outline"
                    title={query ? 'No one matches that name' : 'Everyone is already here'}
                    message={
                      query ? 'Try a different spelling.' : 'New people appear after refreshing.'
                    }
                  />
                )}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Button
            label="Leave group"
            icon="exit-outline"
            variant="secondary"
            disabled={busy}
            loading={exit.isPending && exit.variables === 'leave'}
            onPress={() =>
              confirm(
                'Leave this group?',
                owner && members.length > 1
                  ? 'Ownership passes to the longest-standing member.'
                  : members.length > 1
                    ? "You won't receive its messages any more."
                    : "You're the last member, so the group and its messages will be deleted.",
                'Leave',
                () => exit.mutate('leave'),
              )
            }
          />
          {owner ? (
            <Button
              label="Delete group"
              icon="trash-outline"
              variant="danger"
              disabled={busy}
              loading={exit.isPending && exit.variables === 'delete'}
              onPress={() =>
                confirm(
                  'Delete this group?',
                  'The group and all of its messages are removed for every member.',
                  'Delete',
                  () => exit.mutate('delete'),
                )
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxxl },
  identity: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  center: { textAlign: 'center' },
  editor: { alignSelf: 'stretch', gap: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowCopy: { flex: 1 },
  candidate: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  section: { gap: spacing.md, marginTop: spacing.lg },
});
