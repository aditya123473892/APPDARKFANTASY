import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { EmptyState, Loader } from '@/components/ui';
import { PostList } from '@/components/ui/PostList';
import { ErrorState } from '@/components/feedback/ErrorState';
import { getData } from '@/services/api/backend';
import { mapPost, type BackendPost } from '@/features/feed/services/feedService.real';
import { useToggleLike } from '@/features/feed/hooks/useFeed';
import { isPreviewPost, mockSocialPosts } from '@/features/feed/mockSocial';
import { spacing } from '@/theme';

export default function PostScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const preview = __DEV__ ? mockSocialPosts.find((post) => post.id === id) : undefined;
  const query = useQuery({
    queryKey: ['posts', id],
    queryFn: async () => mapPost(await getData<BackendPost>(`/posts/${encodeURIComponent(id)}`)),
    enabled: Boolean(id) && !preview,
  });
  const toggle = useToggleLike();
  const post = preview ?? query.data;
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <Header title="Post" back backFallback="/home" />
      </View>
      {post ? (
        <PostList
          posts={[post]}
          onToggleLike={
            isPreviewPost(post)
              ? undefined
              : (item) => toggle.mutate({ postId: item.id, liked: !item.liked })
          }
        />
      ) : query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState
          onRetry={() => void query.refetch()}
          message="This post may no longer be available."
        />
      ) : (
        <EmptyState title="Post unavailable" message="This post cannot be displayed." />
      )}
    </Screen>
  );
}
