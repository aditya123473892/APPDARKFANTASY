import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Screen, Header } from '@/components/layout';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostList } from '@/components/ui/PostList';
import type { Post } from '@/features/feed/types';
import {
  durationLabel,
  isVideo,
  mediaPreviews,
  singleMedia,
  usePostPresentation,
} from '@/features/feed/presentation';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function ProfileGrid({
  posts,
  onToggleLike,
  onDelete,
  showSaved = true,
}: {
  posts: Post[];
  onToggleLike?: (post: Post) => void;
  onDelete?: (post: Post) => void;
  showSaved?: boolean;
}) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [tab, setTab] = useState<'grid' | 'saved'>('grid');
  const [selected, setSelected] = useState<{ posts: Post[]; title: string }>();
  const saved = usePostPresentation((state) => state.saved);
  const displayed = tab === 'saved' ? Object.values(saved) : posts;
  const size = (Math.min(width, spacing.contentMax) - 4) / 3;
  return (
    <View>
      <View style={{ flexDirection: 'row', marginTop: spacing.lg, marginBottom: 2 }}>
        {(['grid', ...(showSaved ? ['saved'] : [])] as ('grid' | 'saved')[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={value === 'grid' ? 'Posts grid' : 'Saved posts'}
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
              borderBottomWidth: 2,
              borderBottomColor: tab === value ? theme.colors.primary : 'transparent',
            }}
          >
            <Ionicons
              name={value === 'grid' ? 'grid-outline' : 'bookmark-outline'}
              size={24}
              color={tab === value ? theme.colors.text : theme.colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {displayed.map((post, index) => {
          const media = singleMedia(post);
          const video = isVideo(media);
          const preview = mediaPreviews.get(media?.uri ?? '');
          return (
            <Pressable
              key={post.id}
              accessibilityLabel={`Open ${video ? 'video' : 'image'} post by ${post.user.name}`}
              onPress={() =>
                setSelected({
                  posts: [...displayed.slice(index), ...displayed.slice(0, index)],
                  title: tab === 'grid' ? 'Posts' : 'Saved',
                })
              }
              style={{
                width: size,
                height: size,
                backgroundColor: theme.colors.surfaceMuted,
                overflow: 'hidden',
              }}
            >
              {!post.locked && !media?.locked && (video ? preview?.thumbnail : media?.uri) ? (
                <Image
                  source={{ uri: video ? preview?.thumbnail : media?.uri }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
              {post.locked || media?.locked ? (
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.colors.textMuted}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                />
              ) : video ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#00000080',
                    padding: 4,
                  }}
                >
                  <Ionicons name="play" color="white" size={12} />
                  {preview?.duration ? (
                    <Text variant="caption" weight="regular" style={{ color: 'white' }}>
                      {durationLabel(preview.duration)}
                    </Text>
                  ) : null}
                </View>
              ) : (post.media?.length ?? 0) > 1 ? (
                <Ionicons
                  name="copy"
                  size={20}
                  color="white"
                  style={{ position: 'absolute', top: 8, right: 8 }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {!displayed.length ? (
        <EmptyState
          compact
          icon={tab === 'grid' ? 'camera-outline' : 'bookmark-outline'}
          title={tab === 'grid' ? 'No posts yet' : 'Save what inspires you'}
          message={
            tab === 'grid'
              ? 'Your moments will appear here.'
              : 'Tap the bookmark on a post to find it here.'
          }
        />
      ) : null}
      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(undefined)}
      >
        <Screen padded={false}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Header title={selected?.title ?? 'Posts'} back onBack={() => setSelected(undefined)} />
          </View>
          {selected ? (
            <PostList
              posts={selected.posts
                .filter((post) =>
                  selected.title === 'Posts'
                    ? posts.some((current) => current.id === post.id)
                    : Boolean(saved[post.id]),
                )
                .map(
                  (post) =>
                    posts.find((current) => current.id === post.id) ?? saved[post.id] ?? post,
                )}
              onToggleLike={onToggleLike}
              onDelete={onDelete}
            />
          ) : null}
        </Screen>
      </Modal>
    </View>
  );
}
