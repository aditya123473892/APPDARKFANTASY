import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, EmptyState, Text } from '@/components/ui';
import { PostList } from '@/components/ui/PostList';
import { StoriesRow } from '@/components/ui/StoriesRow';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { ProfileGrid } from '@/features/profile/components/ProfileGrid';
import { simulateMediaUpload } from '@/features/create-post/uploadSingleMedia';
import { isPreviewPost, mockSocialPosts, mockSocialUsers } from '../mockSocial';
import { usePostPresentation } from '../presentation';
import { spacing } from '@/theme';
import { ChatPreview } from '@/features/chat/components/ChatPreview';

export function SocialPreviewScreen() {
  useEffect(
    () => () => {
      usePostPresentation.setState(({ saved }) => ({
        saved: Object.fromEntries(Object.entries(saved).filter(([, post]) => !isPreviewPost(post))),
      }));
    },
    [],
  );
  const [page, setPage] = useState<'Feed' | 'Profile' | 'Chat' | 'Empty' | 'Upload'>('Feed');
  const [posts, setPosts] = useState(mockSocialPosts);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stories, setStories] = useState(true);
  const user = mockSocialUsers[0]!;
  const like = (post: (typeof posts)[number]) =>
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
          : item,
      ),
    );
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <Header title="UI preview" back backFallback="/settings" />
        <Text variant="caption" weight="regular" color="muted">
          Mock content · changes stay in this preview
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
          }}
        >
          {(['Feed', 'Profile', 'Chat', 'Empty', 'Upload'] as const).map((value) => (
            <Button
              key={value}
              label={value}
              size="sm"
              fullWidth={false}
              variant={page === value ? 'primary' : 'secondary'}
              onPress={() => setPage(value)}
            />
          ))}
        </View>
      </View>
      {page === 'Chat' ? <ChatPreview /> : null}
      {page === 'Feed' ? (
        <PostList
          posts={posts}
          onToggleLike={like}
          onOpenAuthor={() => setPage('Profile')}
          ListHeaderComponent={
            <>
              <Button
                label={stories ? 'Hide stories' : 'Show stories'}
                variant="ghost"
                onPress={() => setStories(!stories)}
              />
              {stories ? (
                <StoriesRow
                  users={mockSocialUsers}
                  me={{ ...user, id: 'me' }}
                  onOpen={() => setPage('Profile')}
                  onCreate={() => setPage('Upload')}
                />
              ) : null}
            </>
          }
          ListFooterComponent={
            <Button
              label="Preview empty comments"
              variant="ghost"
              onPress={() =>
                setPosts((current) => [
                  ...current,
                  {
                    ...mockSocialPosts[0]!,
                    id: `preview-empty-${current.length}`,
                    comments: [],
                    replies: 0,
                    likes: 0,
                  },
                ])
              }
            />
          }
        />
      ) : null}
      {page === 'Profile' ? (
        <ScrollView>
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <ProfileHeader
              user={{
                ...user,
                email: '',
                age: 0,
                bio: 'Collecting little moments. City walks, quiet mornings, and a little adventure. ✨',
                interests: [],
              }}
              posts={posts.length}
              followers={1280}
              following={342}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Edit profile"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setPage('Upload')}
              />
              <Button
                label="Share profile"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setPage('Feed')}
              />
            </View>
          </View>
          <ProfileGrid posts={posts} onToggleLike={like} />
        </ScrollView>
      ) : null}
      {page === 'Empty' ? (
        <EmptyState
          icon="camera-outline"
          title="Your feed starts here"
          message="Share a moment and start a conversation."
          actionLabel="See mock posts"
          onAction={() => setPage('Feed')}
        />
      ) : null}
      {page === 'Upload' ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Text>Preview an upload without publishing.</Text>
          <Button
            label={
              uploading
                ? `Uploading ${progress}%`
                : progress === 100
                  ? 'Upload complete · try again'
                  : 'Simulate upload'
            }
            loading={uploading}
            disabled={uploading}
            onPress={() => {
              setUploading(true);
              void simulateMediaUpload(setProgress).finally(() => setUploading(false));
            }}
          />
          <Text accessibilityLiveRegion="polite">{progress}%</Text>
        </View>
      ) : null}
    </Screen>
  );
}
