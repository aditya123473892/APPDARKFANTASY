import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { BottomSheet, Button, Chip, Text } from '@/components/ui';
import { Avatar } from '@/components/ui/Avatar';
import { SearchField } from '@/components/ui/SearchField';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import {
  listMembers,
  premiumLabel,
  setMemberPremium,
  type AdminMember,
  type MemberFilter,
  type PremiumGrant,
} from './adminMembers';

const filters: { value: MemberFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'normal', label: 'Normal' },
  { value: 'premium', label: 'Premium' },
];
const grants: { label: string; grant: PremiumGrant }[] = [
  { label: '1 month', grant: { months: 1 } },
  { label: '3 months', grant: { months: 3 } },
  { label: '6 months', grant: { months: 6 } },
  { label: '1 year', grant: { months: 12 } },
  { label: 'Lifetime', grant: { lifetime: true } },
];

function MemberRow({ member, onPress }: { member: AdminMember; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${member.name}, ${premiumLabel(member)}`}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.colors.border }]}
    >
      <Avatar uri={member.avatar} size={44} label={member.name} />
      <View style={styles.grow}>
        <Text weight="semibold" numberOfLines={1}>
          {member.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {member.username}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          {
            borderColor: member.premium ? theme.colors.gold : theme.colors.border,
            backgroundColor: theme.colors.overlay,
          },
        ]}
      >
        <Text
          variant="caption"
          style={{ color: member.premium ? theme.colors.gold : theme.colors.textMuted }}
        >
          {member.premium ? 'Premium' : 'Normal'}
        </Text>
      </View>
    </Pressable>
  );
}

function MemberSheet({
  member,
  onClose,
  onChanged,
}: {
  member: AdminMember;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [choice, setChoice] = useState(0);
  const picked = grants[choice] ?? grants[0]!;
  const change = useMutation({
    mutationFn: (grant: PremiumGrant | null) => setMemberPremium(member.id, grant),
    onSuccess: (updated, grant) => {
      toast.success(
        grant
          ? `${updated.name}: ${premiumLabel(updated)}`
          : `${updated.name} is now a normal member`,
      );
      onChanged();
      onClose();
    },
    onError: () => toast.error('Couldn’t change this membership. Refresh and try again.'),
  });
  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
      <View style={styles.sheetHead}>
        <Avatar uri={member.avatar} size={56} label={member.name} />
        <View style={styles.grow}>
          <Text variant="subheading">{member.name}</Text>
          <Text variant="caption" color="secondary">
            {member.username}
          </Text>
        </View>
      </View>
      <Text color="secondary">
        Current: {premiumLabel(member)}
        {member.blocked ? ' · account blocked' : ''}
      </Text>

      <Text variant="label">{member.premium ? 'Add premium time' : 'Move to premium'}</Text>
      <View style={styles.chips}>
        {grants.map((item, index) => (
          <Chip
            key={item.label}
            size="sm"
            label={item.label}
            selected={choice === index}
            onPress={() => setChoice(index)}
          />
        ))}
      </View>
      {member.premium && (
        <Text variant="caption" color="muted">
          {member.lifetime
            ? 'Lifetime premium never expires. Move them back to normal to change it.'
            : 'Added on top of the time they already have.'}
        </Text>
      )}
      <Button
        label={member.premium ? `Add ${picked.label.toLowerCase()}` : 'Make premium'}
        icon="sparkles-outline"
        loading={change.isPending && change.variables !== null}
        disabled={change.isPending || member.lifetime}
        onPress={() => change.mutate(picked.grant)}
      />
      {member.premium && (
        <Button
          label="Move back to normal"
          icon="arrow-undo-outline"
          variant="danger"
          loading={change.isPending && change.variables === null}
          disabled={change.isPending}
          onPress={() => change.mutate(null)}
        />
      )}
    </ScrollView>
  );
}

/** Admin-only: search members and move them between normal and premium. */
export function AdminMembersScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const client = useQueryClient();
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [search, setSearch] = useState('');
  const needle = useDebounce(search.trim(), 300);
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['admin-members', filter, needle],
    queryFn: ({ pageParam }) => listMembers(filter, needle, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const members = query.data?.pages.flatMap((page) => page.users) ?? [];
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Premium members" subtitle="Admin" back backFallback="/settings" />
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or email"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.filters}>
        {filters.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={filter === item.value}
            onPress={() => setFilter(item.value)}
          />
        ))}
      </View>
      {query.isPending ? (
        <ActivityIndicator style={styles.empty} color={theme.colors.primaryText} />
      ) : query.isError ? (
        <ErrorState
          onRetry={() => void query.refetch()}
          message="Couldn’t load members. Check that your account is an admin."
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(member) => member.id}
          renderItem={({ item }) => <MemberRow member={item} onPress={() => setSelected(item)} />}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            <Text color="secondary" center style={styles.empty}>
              No members found.
            </Text>
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={theme.colors.textMuted} />
            ) : undefined
          }
          contentContainerStyle={styles.list}
        />
      )}
      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <MemberSheet
            key={selected.id}
            member={selected}
            onClose={() => setSelected(null)}
            onChanged={() => void client.invalidateQueries({ queryKey: ['admin-members'] })}
          />
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  list: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
  },
  empty: { marginTop: spacing.huge },
  sheet: { maxHeight: 560 },
  sheetContent: { gap: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
