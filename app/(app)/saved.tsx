import { Header, Screen } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { PostList } from '@/components/ui/PostList';
import { usePostPresentation } from '@/features/feed/presentation';
import { useToggleLike } from '@/features/feed/hooks/useFeed';
import { isPreviewPost } from '@/features/feed/mockSocial';

export default function SavedScreen() {
  const saved = usePostPresentation((state) => state.saved);
  const toggle = useToggleLike();
  return (
    <Screen padded={false}>
      <Header title="Saved" back backFallback="/profile" />
      <PostList
        posts={Object.values(saved)}
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
          <EmptyState
            icon="bookmark-outline"
            title="Saved items"
            message="Tap the bookmark on a post to save it for this session."
          />
        }
      />
    </Screen>
  );
}
