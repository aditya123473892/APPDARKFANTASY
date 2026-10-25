import { useRef, useState, type ComponentRef } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useAddComment, useComments, useDeleteComment } from '@/features/feed/hooks/useFeed';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Post, PostComment } from '@/features/feed/types';
import { isPreviewPost, mockSocialComments } from '@/features/feed/mockSocial';
import { createClientId } from '@/utils/clientId';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Avatar } from './Avatar';
import { CommentItem } from './CommentItem';
import { SocialSheet } from './SocialSheet';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Loader } from './Loader';
export function CommentsSheet({
  post,
  visible,
  onClose,
}: {
  post: Post;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const me = useAuthStore((state) => state.user);
  const preview = isPreviewPost(post);
  const comments = useComments(post.id, visible && !preview);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const [local, setLocal] = useState<PostComment[]>(post.comments ?? []);
  const [draft, setDraft] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const pendingKey = useRef<{ text: string; clientId: string } | null>(null);
  const rows = preview ? local : (comments.data?.pages.flatMap((page) => page.comments) ?? []);
  const submit = () => {
    const text = draft.trim();
    if (!text || add.isPending) return;
    if (pendingKey.current?.text !== text)
      pendingKey.current = { text, clientId: createClientId() };
    setDraft('');
    if (preview)
      setLocal((current) => [
        ...current,
        {
          id: createClientId(),
          content: text,
          author: {
            id: me?.id ?? 'me',
            name: me?.name ?? 'You',
            handle: '',
            avatarUri: me?.avatarUri ?? '',
          },
          createdAt: new Date().toISOString(),
        },
      ]);
    else
      add.mutate(
        { content: text, clientId: pendingKey.current.clientId },
        {
          onSuccess: () => {
            pendingKey.current = null;
          },
          onError: () => setDraft((current) => current || text),
        },
      );
  };
  return (
    <SocialSheet visible={visible} onClose={onClose} title="Comments">
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item, index }) => (
          <CommentItem
            comment={item}
            onReply={(name) => {
              setDraft(`@${name} `);
              input.current?.focus();
            }}
            onDelete={
              item.author.id === me?.id || post.user.id === me?.id
                ? () =>
                    preview
                      ? setLocal((current) => current.filter((c) => c.id !== item.id))
                      : remove.mutate(item.id)
                : undefined
            }
            replies={
              preview && index === 0
                ? mockSocialComments.map((c) => ({ ...c, id: `reply-${c.id}` }))
                : []
            }
          />
        )}
        ListEmptyComponent={
          comments.isPending && !preview ? (
            <Loader />
          ) : comments.isError && !preview ? (
            <Pressable
              accessibilityLabel="Retry comments"
              onPress={() => void comments.refetch()}
              style={{ padding: spacing.xl }}
            >
              <Text center color="muted">
                Couldn't load comments. Tap to retry.
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
              <Text center color="muted">
                No comments yet. Start the conversation.
              </Text>
            </View>
          )
        }
        onEndReached={() => {
          if (!preview && comments.hasNextPage && !comments.isFetchingNextPage)
            void comments.fetchNextPage();
        }}
        ListFooterComponent={comments.isFetchingNextPage ? <Loader /> : undefined}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }}
      >
        <Avatar uri={me?.avatarUri ?? ''} label={me?.name ?? 'You'} size={32} />
        <TextInput
          ref={input}
          accessibilityLabel="Write a comment"
          multiline
          maxLength={2000}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 100,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.xl,
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            fontFamily: typography.family.regular,
            fontSize: 14,
          }}
        />
        {draft.trim() ? (
          <Pressable
            accessibilityLabel="Post comment"
            disabled={add.isPending}
            onPress={submit}
            style={{ justifyContent: 'center' }}
          >
            <Text color="primary" weight="semibold">
              Post
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SocialSheet>
  );
}
