import { usePhotoDraftCleanup } from '@/hooks/usePhotoDraftCleanup';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Header, KeyboardAvoidingScreen, Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, Input, Loader, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { ProtectedRoute } from '@/features/auth/components/Access';
import { createClientId } from '@/features/chat/hooks/useChat';
import { groupConversation } from '@/features/chat/services/chatService.real';
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_MEMBERS_MAX,
  GROUP_NAME_MAX,
  groupService,
} from '@/features/chat/services/groupService';
import type { Conversation } from '@/features/chat/types';
import { pickImage } from '@/features/create-post/pickMedia';
import type { UploadAsset } from '@/features/feed/types';
import { useDiscoverProfiles } from '@/features/profile/hooks/useProfiles';
import type { ProfileView } from '@/features/profile/types';
import { useDebounce } from '@/hooks/useDebounce';
import { describeError } from '@/services/errors';
import { queryKeys } from '@/services/queryKeys';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** The creator is always a member, so this many others can be selected. */
const MAX_SELECTED = GROUP_MEMBERS_MAX - 1;

function NewGroup(): React.JSX.Element {
  const router = useRouter();
  const client = useQueryClient();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<UploadAsset | null>(null);
  usePhotoDraftCleanup(photo ? [photo] : []);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProfileView[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // One key per group being created: a retry after a lost response returns the
  // group the server already made instead of creating a duplicate.
  const clientId = useRef(createClientId());
  const query = useDebounce(search.trim(), 250);
  // Searches every account on the server and pages through results; selections
  // made under an earlier search term are kept.
  const users = useDiscoverProfiles(query);
  const results = users.data ?? [];

  const nameError = submitted && !name.trim() ? 'Give the group a name.' : undefined;
  const membersError = submitted && !selected.length ? 'Choose at least one member.' : undefined;
  const selectedIds = useMemo(() => new Set(selected.map((user) => user.id)), [selected]);

  const create = useMutation({
    mutationFn: async () => {
      const group = await groupService.create({
        name,
        description,
        members: selected.map((user) => user.id),
        clientId: clientId.current,
      });
      let photoFailed = false;
      if (photo) {
        try {
          await groupService.uploadIcon(group._id, photo);
        } catch {
          photoFailed = true;
        }
      }
      return { group, photoFailed };
    },
    onSuccess: ({ group, photoFailed }) => {
      // Show the group in Chats immediately; the refetch then fills in server state.
      const conversation = groupConversation(group);
      client.setQueryData<Conversation[]>(queryKeys.conversations, (rows) =>
        rows && !rows.some((row) => row.id === conversation.id) ? [conversation, ...rows] : rows,
      );
      void client.invalidateQueries({ queryKey: queryKeys.conversations });
      if (photoFailed)
        toast.error('Group created, but the photo could not be uploaded. Add it from group info.');
      else toast.success('Group created');
      router.replace(`/chat/group:${group._id}`);
    },
    onError: (error) =>
      toast.error(describeError(error, "We couldn't create the group. Please try again.")),
  });

  const toggle = useCallback((user: ProfileView) => {
    setSelected((current) => {
      if (current.some((item) => item.id === user.id))
        return current.filter((item) => item.id !== user.id);
      if (current.length >= MAX_SELECTED) {
        toast.error(`A group can have up to ${GROUP_MEMBERS_MAX} members.`);
        return current;
      }
      return [...current, user];
    });
  }, []);

  const choosePhoto = async () => {
    try {
      const asset = await pickImage();
      if (asset) setPhoto(asset);
    } catch {
      toast.error("Couldn't open your photos.");
    }
  };

  const submit = () => {
    setSubmitted(true);
    if (!name.trim() || !selected.length || create.isPending) return;
    create.mutate();
  };

  const busy = create.isPending;
  const form = (
    <View style={styles.form}>
      <View style={styles.identity}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Change group photo' : 'Add a group photo'}
          disabled={busy}
          onPress={() => void choosePhoto()}
          style={[styles.photo, { backgroundColor: theme.colors.surfaceElevated }]}
        >
          {photo ? (
            <Avatar uri={photo.uri} label="Group photo" size={56} />
          ) : (
            <Ionicons name="camera-outline" size={28} color={theme.colors.textSecondary} />
          )}
        </Pressable>
        <View style={styles.identityFields}>
          <Input
            label="Group name"
            value={name}
            onChangeText={setName}
            maxLength={GROUP_NAME_MAX}
            error={nameError}
            editable={!busy}
            returnKeyType="next"
          />
        </View>
      </View>
      {photo ? (
        <Button
          label="Remove photo"
          variant="ghost"
          size="sm"
          fullWidth={false}
          disabled={busy}
          onPress={() => setPhoto(null)}
        />
      ) : null}
      <Input
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={GROUP_DESCRIPTION_MAX}
        multiline
        showCount
        editable={!busy}
      />
      <View style={styles.membersHeading}>
        <Text variant="subheading">Members</Text>
        <Text variant="caption" color={membersError ? 'danger' : 'secondary'}>
          {membersError ?? `${selected.length} selected · you'll be the owner`}
        </Text>
      </View>
      {selected.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {selected.map((user) => (
            <Pressable
              key={user.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${user.name}`}
              disabled={busy}
              onPress={() => toggle(user)}
              style={[styles.chip, { backgroundColor: theme.colors.primarySoft }]}
            >
              <Avatar uri={user.avatarUri} label={user.name} size={32} />
              <Text variant="label" numberOfLines={1} style={styles.chipName}>
                {user.name}
              </Text>
              <Ionicons name="close" size={16} color={theme.colors.text} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Input
        accessibilityLabel="Search people"
        icon="search-outline"
        placeholder="Search people"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Header title="New group" back backFallback="/chats" />
      </View>
      <KeyboardAvoidingScreen>
        {/* One list in every state, so the form (and a focused search field) never remounts. */}
        <FlatList
          data={users.isError && !users.data ? [] : results}
          keyExtractor={(user) => user.id}
          ListHeaderComponent={form}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          onRefresh={() => void users.refetch()}
          refreshing={users.isRefetching && !users.isFetchingNextPage && !users.isPlaceholderData}
          onEndReached={() => {
            if (users.hasNextPage && !users.isFetching && !users.isFetchNextPageError)
              void users.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            users.isPending ? (
              <Loader label="Loading people" />
            ) : users.isError ? (
              <ErrorState
                onRetry={() => void users.refetch()}
                message={describeError(users.error, "We couldn't load people to add.")}
              />
            ) : (
              <EmptyState
                compact
                icon="people-outline"
                title={query ? 'No one matches that name' : 'No people to add yet'}
                message={query ? 'Try a different spelling.' : 'Pull down to refresh.'}
              />
            )
          }
          ListFooterComponent={
            users.isFetchingNextPage ? (
              <Loader label="Loading more people" />
            ) : users.isFetchNextPageError ? (
              <Button
                label="Try loading more people again"
                variant="secondary"
                onPress={() => void users.fetchNextPage()}
              />
            ) : undefined
          }
          renderItem={({ item }) => {
            const checked = selectedIds.has(item.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: busy }}
                accessibilityLabel={item.name}
                disabled={busy}
                onPress={() => toggle(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: checked
                      ? theme.colors.primarySoft
                      : pressed
                        ? theme.colors.surfacePressed
                        : theme.colors.surface,
                  },
                ]}
              >
                <Avatar uri={item.avatarUri} label={item.name} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Ionicons
                  name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={32}
                  color={checked ? theme.colors.primary : theme.colors.textMuted}
                />
              </Pressable>
            );
          }}
        />
        <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
          <Button
            label={busy ? 'Creating group…' : 'Create group'}
            loading={busy}
            disabled={busy}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingScreen>
    </Screen>
  );
}

export default function NewGroupRoute(): React.JSX.Element {
  return (
    <ProtectedRoute capability="canCreateGroups">
      <NewGroup />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.screen },
  form: { gap: spacing.md, paddingBottom: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  identityFields: { flex: 1 },
  photo: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  membersHeading: { gap: spacing.xxs, marginTop: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xxs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    minHeight: 36,
    borderRadius: radius.pill,
    maxWidth: 180,
  },
  chipName: { flexShrink: 1 },
  list: { paddingHorizontal: spacing.screen, gap: spacing.sm, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: spacing.touch + 16,
  },
  rowName: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
