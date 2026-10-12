import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { Post } from '@/data/posts';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Avatar } from './Avatar';
import { Divider } from './Divider';
import { Text } from './Text';
import { ThreadLine } from './ThreadLine';

function RichText({ body }: { body: string }): React.JSX.Element {
  const chunks = body.split(/([#@][\w]+)/g);
  return <Text variant="body">{chunks.map((chunk, index) => <Text key={`${chunk}-${index}`} color={chunk.startsWith('#') || chunk.startsWith('@') ? 'primary' : 'default'}>{chunk}</Text>)}</Text>;
}

export const PostCard = memo(function PostCard({ post }: { post: Post }): React.JSX.Element {
  const { theme } = useTheme();
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [expanded, setExpanded] = useState(false);
  const scale = useSharedValue(1);
  const likeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const like = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((value) => !value);
    scale.set(0.72);
    scale.set(withSpring(1, { damping: 8, stiffness: 240 }));
  };
  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; count?: number; onPress: () => void }[] = [
    { icon: liked ? 'heart' : 'heart-outline', label: 'Like post', count: post.likes + (liked && !post.liked ? 1 : 0), onPress: like },
    { icon: 'chatbubble-outline', label: 'Comment', count: post.replies, onPress: () => undefined },
    { icon: 'repeat-outline', label: 'Repost', count: post.reposts, onPress: () => undefined },
    { icon: 'paper-plane-outline', label: 'Send', onPress: () => undefined },
  ];

  return <Animated.View layout={LinearTransition.duration(180)}>
    <View style={styles.post}>
      <View style={styles.rail}><Avatar uri={post.user.avatarUri} label={post.user.name} size={40} /><ThreadLine /></View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="label" numberOfLines={1}>{post.user.name}</Text>
          {post.user.verified ? <Ionicons name="checkmark-circle" size={15} color={theme.colors.primary} /> : null}
          <Text variant="caption" color="muted">· {post.createdAt}</Text>
          <View style={styles.grow} />
          <Pressable accessibilityLabel="Post options" hitSlop={spacing.sm} style={styles.more}><Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} /></Pressable>
        </View>
        <Pressable onPress={() => setExpanded(true)}>
          <Text numberOfLines={expanded ? undefined : 6}><RichText body={post.body} /></Text>
          {!expanded && post.body.length > 180 ? <Text variant="caption" color="muted">Show more</Text> : null}
        </Pressable>
        {post.media?.length ? <View style={styles.mediaWrap}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {post.media.map((uri, index) => <Image key={uri} source={{ uri }} contentFit="cover" accessibilityLabel={`Post media ${index + 1}`} style={[styles.media, { borderColor: theme.colors.border }]} />)}
          </ScrollView>
          {post.media.length > 1 ? <View style={styles.dots}>{post.media.map((uri, index) => <View key={uri} style={[styles.dot, { backgroundColor: index === 0 ? theme.colors.primary : theme.colors.textMuted }]} />)}</View> : null}
        </View> : null}
        <View style={styles.actions}>{actions.map((action, index) => <Animated.View key={action.label} style={index === 0 ? likeStyle : undefined}>
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name={action.icon} size={21} color={index === 0 && liked ? theme.colors.primary : theme.colors.textSecondary} />
            {action.count ? <Text variant="caption" color="muted">{action.count}</Text> : null}
          </Pressable>
        </Animated.View>)}</View>
        <View style={styles.footer}>
          <View style={styles.faces}>{post.replierAvatars?.map((uri, index) => <Avatar key={uri} uri={uri} label="Replier" size={20 + index * 2} />)}</View>
          <Text variant="caption" color="muted">{post.replies} replies · {post.likes} likes</Text>
        </View>
      </View>
    </View>
    <Divider />
  </Animated.View>;
});

const styles = StyleSheet.create({
  post: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  rail: { width: spacing.huge, alignItems: 'center', marginRight: spacing.md },
  content: { flex: 1, gap: spacing.sm, paddingBottom: spacing.lg },
  header: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, grow: { flex: 1 }, more: { minWidth: 32, alignItems: 'flex-end' },
  mediaWrap: { gap: spacing.sm }, media: { width: 280, aspectRatio: 1.3, borderRadius: radius.md, borderWidth: 1, marginRight: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }, dot: { width: 4, height: 4, borderRadius: radius.full },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginLeft: -spacing.md }, action: { minHeight: spacing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }, pressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, faces: { flexDirection: 'row', alignItems: 'center' },
});
