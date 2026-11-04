import { Header, Screen } from '@/components/layout';
import { EmptyState, Loader } from '@/components/ui';
import { PostList } from '@/components/ui/PostList';
import { usePostPresentation } from '@/features/feed/presentation';
import { useSavedPostsSync, useToggleLike } from '@/features/feed/hooks/useFeed';
import { isPreviewPost } from '@/features/feed/mockSocial';

export default function SavedScreen() {
  const saved = usePostPresentation((state) => state.saved);
  const toggle = useToggleLike();
  const sync = useSavedPostsSync();
  const posts = Object.values(saved);
  return (
    <Screen padded={false}>
      <Header title="Saved" back backFallback="/profile" />
      <PostList
        posts={posts}
        onToggleLike={(post) => {
          if (isPreviewPost(post))
            usePostPresentation.setState({
              saved: {
                ...saved,
                [post.id]: {
                  ...post,
                  liked: !post.liked,
                  likes: post.likes + (post.liked ? -1 : 1),
                },
              },
            });
          else toggle.mutate({ postId: post.id, liked: !post.liked });
        }}
        ListEmptyComponent={
          sync.isPending ? (
            <Loader />
          ) : (
            <EmptyState
              icon="bookmark-outline"
              title={sync.isError ? 'Saved posts unavailable' : 'Saved items'}
              message={
                sync.isError
                  ? 'Check your connection, then reopen this screen.'
                  : 'Tap the bookmark on a post to save it here.'
              }
            />
          )
        }
      />
    </Screen>
  );
}
