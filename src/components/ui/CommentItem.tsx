import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PostComment } from '@/features/feed/types';
import { formatRelativeTime } from '@/utils/formatters';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { Avatar } from './Avatar';
import { Pressable } from './Pressable';
import { Text } from './Text';

import { dialog } from '@/components/ui/dialogStore';
const NO_REPLIES: PostComment[] = [];

/** Memoised: pass stable callbacks so a keystroke or one change does not redraw every row. */
export const CommentItem = memo(function CommentItem({
  comment,
  onReply,
  onDelete,
  onLike,
  replies = NO_REPLIES,
}: {
  comment: PostComment;
  onReply: (name: string) => void;
  onDelete?: (comment: PostComment) => void;
  /** Saves the like on the server; without it (preview posts) the heart is local. */
  onLike?: (comment: PostComment) => void;
  replies?: PostComment[];
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const [localLiked, setLocalLiked] = useState(false);
  const liked = onLike ? Boolean(comment.likedByMe) : localLiked;
  const likeCount = onLike ? (comment.likeCount ?? 0) : localLiked ? 1 : 0;
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Avatar uri={comment.author.avatarUri} label={comment.author.name} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14 }}>
            <Text weight="semibold" style={{ fontSize: 14 }}>
              {comment.author.handle || comment.author.name}{' '}
            </Text>
            {comment.content}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            <Text variant="caption" weight="regular" color="muted">
              {comment.pending
                ? 'Posting…'
                : comment.createdAt
                  ? formatRelativeTime(comment.createdAt)
                  : 'Just now'}
            </Text>
            <Pressable
              accessibilityLabel={`Reply to ${comment.author.name}`}
              onPress={() => onReply(comment.author.handle || comment.author.name)}
              style={{ justifyContent: 'center' }}
            >
              <Text variant="caption" weight="semibold" color="muted">
                Reply
              </Text>
            </Pressable>
            {!comment.pending ? (
              <Pressable
                accessibilityLabel="Comment options"
                onPress={() =>
                  dialog.alert('Comment options', undefined, [
                    onDelete
                      ? { text: 'Delete', style: 'destructive', onPress: () => onDelete(comment) }
                      : {
                          text: 'Report',
                          onPress: () =>
                            router.push({
                              pathname: '/report',
                              params: { targetType: 'comment', targetId: comment.id },
                            }),
                        },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
                style={{ justifyContent: 'center' }}
              >
                <Text color="muted">···</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityLabel={liked ? 'Unlike comment' : 'Like comment'}
          accessibilityState={{ selected: liked }}
          disabled={comment.pending}
          onPress={() => (onLike ? onLike(comment) : setLocalLiked(!localLiked))}
          style={{ alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={14}
            color={liked ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text variant="caption" weight="regular" color="muted">
            {likeCount ? likeCount.toLocaleString() : ''}
          </Text>
        </Pressable>
      </View>
      {replies.length ? (
        <View style={{ marginLeft: 48 }}>
          <Pressable
            accessibilityLabel={expanded ? 'Hide replies' : `View ${replies.length} replies`}
            onPress={() => setExpanded(!expanded)}
            style={{ justifyContent: 'center' }}
          >
            <Text variant="caption" color="muted" weight="semibold">
              {expanded ? 'Hide replies' : `View ${replies.length} replies`}
            </Text>
          </Pressable>
          {expanded
            ? replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} onReply={onReply} />
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
});
