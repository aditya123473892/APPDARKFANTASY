import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, FlatList, type FlatListProps } from 'react-native';
import type { Post } from '@/features/feed/types';
import { isVideo } from '@/features/feed/presentation';
import { PostCard } from './PostCard';
const viewabilityConfig = { itemVisiblePercentThreshold: 60, minimumViewTime: 120 };

export function PostList({
  posts,
  onToggleLike,
  onOpenAuthor,
  onDelete,
  ...props
}: Omit<FlatListProps<Post>, 'data' | 'renderItem'> & {
  posts: Post[];
  onToggleLike?: (post: Post) => void;
  onOpenAuthor?: (post: Post) => void;
  onDelete?: (post: Post) => void;
}) {
  const [active, setActive] = useState<string>();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const onViewableItemsChanged = useCallback<
    NonNullable<FlatListProps<Post>['onViewableItemsChanged']>
  >(
    ({ viewableItems }) =>
      setActive(viewableItems.find(({ item }) => item.media?.some(isVideo))?.item.id),
    [],
  );
  return (
    <FlatList
      {...props}
      data={posts}
      keyExtractor={(post) => post.id}
      extraData={[active, focused, foreground]}
      windowSize={5}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      removeClippedSubviews
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          active={foreground && focused && active === item.id}
          onToggleLike={onToggleLike}
          onOpenAuthor={onOpenAuthor}
          onDelete={onDelete}
        />
      )}
    />
  );
}
