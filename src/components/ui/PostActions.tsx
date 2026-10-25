import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Pressable } from './Pressable';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';

export function PostActions({
  liked,
  saved,
  onLike,
  onComment,
  onShare,
  onSave,
  likeDisabled = false,
}: {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  likeDisabled?: boolean;
}) {
  const { theme } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const like = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onLike();
  };
  const icon = (
    name: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
    selected = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.button}
    >
      <Ionicons name={name} size={24} color={theme.colors.text} />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
        accessibilityState={{ selected: liked, disabled: likeDisabled }}
        disabled={likeDisabled}
        onPress={like}
        style={styles.button}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? theme.colors.primary : theme.colors.text}
          />
        </Animated.View>
      </Pressable>
      {icon('chatbubble-outline', 'Comment on post', onComment)}
      {icon('paper-plane-outline', 'Share post', onShare)}
      <View style={{ flex: 1 }} />
      {icon(
        saved ? 'bookmark' : 'bookmark-outline',
        saved ? 'Unsave post' : 'Save post',
        onSave,
        saved,
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.lg,
  },
  button: { width: 24, alignItems: 'center', justifyContent: 'center', marginHorizontal: -10 },
});
