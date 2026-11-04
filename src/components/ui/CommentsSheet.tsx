import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from 'react';
import { FlatList, TextInput, View, type ListRenderItem } from 'react-native';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useToggleCommentLike,
} from '@/features/feed/hooks/useFeed';
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

const NO_REPLIES: PostComment[] = [];
const PREVIEW_REPLIES = mockSocialComments.map((c) => ({ ...c, id: `reply-${c.id}` }));

type ComposerHandle = { reply: (name: string) => void };

/**
 * Owns the draft, so typing re-renders only the input row, not every comment.
 * `onSubmit` returns the text to put back when sending fails.
 */
function CommentComposer({
  ref,
  busy,
  onSubmit,
}: {
  ref: Ref<ComposerHandle>;
  busy: boolean;
  onSubmit: (text: string, restore: (text: string) => void) => void;
}) {
  const { theme } = useTheme();
  const me = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useImperativeHandle(ref, () => ({
    reply: (name) => {
      setDraft(`@${name} `);
      input.current?.focus();
    },
  }));
  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    onSubmit(text, (failed) => setDraft((current) => current || failed));
  };
  return (
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
          disabled={busy}
          onPress={submit}
          style={{ justifyContent: 'center' }}
        >
          <Text color="primary" weight="semibold">
            Post
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CommentsSheet({
  post,
  visible,
  onClose,
}: {
  post: Post;
  visible: boolean;
  onClose: () => void;
}) {
  const me = useAuthStore((state) => state.user);
  const preview = isPreviewPost(post);
  const comments = useComments(post.id, visible && !preview);
  const add = useAddComment(post.id);
  const { mutate: addComment } = add;
  const { mutate: removeComment } = useDeleteComment(post.id);
  const toggleLike = useToggleCommentLike(post.id);
  const [local, setLocal] = useState<PostComment[]>(post.comments ?? []);
  const composer = useRef<ComposerHandle>(null);
  const pendingKey = useRef<{ text: string; clientId: string } | null>(null);
  const rows = useMemo(
    () => (preview ? local : (comments.data?.pages.flatMap((page) => page.comments) ?? [])),
    [preview, local, comments.data],
  );
  const submit = useCallback(
    (text: string, restore: (text: string) => void) => {
      if (pendingKey.current?.text !== text)
        pendingKey.current = { text, clientId: createClientId() };
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
        addComment(
          { content: text, clientId: pendingKey.current.clientId },
          {
            onSuccess: () => {
              pendingKey.current = null;
            },
            onError: () => restore(text),
          },
        );
    },
    [preview, me, addComment],
  );
  const reply = useCallback((name: string) => composer.current?.reply(name), []);
  const remove = useCallback(
    (comment: PostComment) =>
      preview
        ? setLocal((current) => current.filter((c) => c.id !== comment.id))
        : removeComment(comment.id),
    [preview, removeComment],
  );
  const ownsPost = post.user.id === me?.id;
  const myId = me?.id;
  const renderItem = useCallback<ListRenderItem<PostComment>>(
    ({ item, index }) => (
      <CommentItem
        comment={item}
        onReply={reply}
        onDelete={ownsPost || item.author.id === myId ? remove : undefined}
        onLike={preview ? undefined : toggleLike}
        replies={preview && index === 0 ? PREVIEW_REPLIES : NO_REPLIES}
      />
    ),
    [reply, remove, toggleLike, ownsPost, myId, preview],
  );
  return (
    <SocialSheet visible={visible} onClose={onClose} title="Comments">
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={renderItem}
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
      <CommentComposer ref={composer} busy={add.isPending} onSubmit={submit} />
    </SocialSheet>
  );
}
