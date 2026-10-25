import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { FitImage } from '@/components/ui/FitImage';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { BottomSheet, Button, Chip, Text, TextField } from '@/components/ui';
import { RemoteMedia } from '@/components/ui/RemoteMedia';
import { toast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import {
  flagReasons,
  listAdminMedia,
  reasonLabel,
  setFlag,
  setPremium,
  type AdminPost,
  type FlagReason,
  type MediaFilter,
} from './adminMedia';

const filters: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'premium', label: 'Subscribers' },
  { value: 'video', label: 'Videos' },
];

function Tag({ label, tone }: { label: string; tone: 'gold' | 'danger' | 'muted' }) {
  const { theme } = useTheme();
  const color =
    tone === 'gold'
      ? theme.colors.gold
      : tone === 'danger'
        ? theme.colors.danger
        : theme.colors.textMuted;
  return (
    <View style={[styles.tag, { borderColor: color, backgroundColor: theme.colors.overlay }]}>
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function PostTile({ post, onPress }: { post: AdminPost; onPress: () => void }) {
  const { theme } = useTheme();
  const first = post.media[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Post by ${post.owner}${post.premium ? ', subscribers only' : ''}${post.flag ? ', flagged' : ''}`}
      onPress={onPress}
      style={styles.cell}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: theme.colors.surfaceMuted,
            aspectRatio: first?.kind === 'photo' && first.uri ? undefined : 1,
          },
        ]}
      >
        {first?.kind === 'photo' && first.uri ? (
          <FitImage
            uri={first.uri}
            cachePolicy="none"
            accessibilityLabel={`Photo posted by ${post.owner}`}
          />
        ) : (
          <Ionicons
            name={first?.kind === 'video' ? 'play-circle-outline' : 'image-outline'}
            size={34}
            color={theme.colors.textMuted}
          />
        )}
        <View style={styles.tags}>
          {post.premium && <Tag label="Subscribers" tone="gold" />}
          {post.flag && (
            <Tag label={post.flag.hidden ? 'Flagged · hidden' : 'Flagged'} tone="danger" />
          )}
          {post.media.length > 1 && <Tag label={`${post.media.length} items`} tone="muted" />}
        </View>
      </View>
      <Text variant="caption" color="secondary" numberOfLines={1}>
        {post.owner}
      </Text>
    </Pressable>
  );
}

function PostSheet({
  post,
  onClose,
  onChanged,
}: {
  post: AdminPost;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { theme } = useTheme();
  const [reason, setReason] = useState<FlagReason>(post.flag?.reason ?? 'nudity_sexual');
  const [note, setNote] = useState(post.flag?.note ?? '');
  const [hide, setHide] = useState(post.flag?.hidden ?? false);
  const [width, setWidth] = useState(0);
  const done = (message: string) => {
    toast.success(message);
    onChanged();
    onClose();
  };
  const fail = () => toast.error('Couldn’t update this post. Refresh and try again.');
  const premium = useMutation({
    mutationFn: () => setPremium(post.id, !post.premium),
    onSuccess: () =>
      done(post.premium ? 'Post is now free for everyone' : 'Post is now for subscribers'),
    onError: fail,
  });
  const flag = useMutation({
    mutationFn: (next: Parameters<typeof setFlag>[1]) => setFlag(post.id, next),
    onSuccess: (_, next) => done(next ? 'Post flagged' : 'Flag removed'),
    onError: fail,
  });
  const busy = premium.isPending || flag.isPending;
  return (
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={styles.sheetContent}
      keyboardShouldPersistTaps="handled"
    >
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ borderRadius: radius.md }}
          >
            {post.media.map((item, index) => (
              <RemoteMedia
                key={`${item.uri}-${index}`}
                uri={item.uri}
                mimetype={item.kind === 'video' ? 'video/mp4' : 'image/jpeg'}
                width={width}
                height={width * 0.75}
                privateMedia
              />
            ))}
          </ScrollView>
        )}
      </View>
      <Text variant="subheading">{post.owner}</Text>
      {!!post.caption && <Text color="secondary">{post.caption}</Text>}
      <Text variant="caption" color="muted">
        {post.media.length} item{post.media.length === 1 ? '' : 's'} · status {post.status}
        {post.createdAt ? ` · ${new Date(post.createdAt).toLocaleDateString()}` : ''}
      </Text>

      <Text variant="label">Type</Text>
      <Button
        label={post.premium ? 'Make free for everyone' : 'Make subscribers only'}
        icon={post.premium ? 'lock-open-outline' : 'sparkles-outline'}
        variant="secondary"
        loading={premium.isPending}
        disabled={busy}
        onPress={() => premium.mutate()}
      />

      <Text variant="label">
        {post.flag ? `Flagged: ${reasonLabel(post.flag.reason)}` : 'Flag'}
      </Text>
      <View style={styles.reasons}>
        {flagReasons.map((value) => (
          <Chip
            key={value}
            size="sm"
            label={reasonLabel(value)}
            selected={reason === value}
            onPress={() => setReason(value)}
          />
        ))}
      </View>
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        maxLength={300}
        placeholder="Why is this flagged?"
      />
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text>Hide from other members</Text>
          <Text variant="caption" color="secondary">
            Only the owner and staff can see it while flagged.
          </Text>
        </View>
        <Switch
          value={hide}
          onValueChange={setHide}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>
      <Button
        label={post.flag ? 'Update flag' : 'Flag post'}
        icon="flag-outline"
        variant="danger"
        loading={flag.isPending}
        disabled={busy}
        onPress={() => flag.mutate({ reason, note: note.trim() || undefined, hide })}
      />
      {post.flag && (
        <Button
          label="Remove flag"
          variant="ghost"
          disabled={busy}
          onPress={() => flag.mutate(null)}
        />
      )}
    </ScrollView>
  );
}

/** Admin-only review of every post photo and video, with flagging and premium controls. */
export function AdminMediaScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const client = useQueryClient();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [selected, setSelected] = useState<AdminPost | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['admin-media', filter],
    queryFn: ({ pageParam }) => listAdminMedia(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Media review" subtitle="Admin" back backFallback="/settings" />
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
          message="Couldn’t load media. Check that your account is an admin."
        />
      ) : (
        <FlatList
          data={posts}
          numColumns={2}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <PostTile post={item} onPress={() => setSelected(item)} />}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            <Text color="secondary" center style={styles.empty}>
              Nothing here yet.
            </Text>
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={theme.colors.textMuted} />
            ) : undefined
          }
          contentContainerStyle={styles.grid}
        />
      )}
      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <PostSheet
            key={selected.id}
            post={selected}
            onClose={() => setSelected(null)}
            onChanged={() => void client.invalidateQueries({ queryKey: ['admin-media'] })}
          />
        )}
      </BottomSheet>
    </Screen>
  );
}
const styles = StyleSheet.create({
  grow: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  grid: { paddingBottom: spacing.xl },
  cell: { width: '50%', padding: spacing.xs, gap: spacing.xs },
  thumb: {
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.none,
  },
  empty: { marginTop: spacing.huge },
  sheet: { maxHeight: 620 },
  sheetContent: { gap: spacing.md },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
