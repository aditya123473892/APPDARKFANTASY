import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';
import { spacing, radius } from '@/theme';

function Dot({ delay }: { delay: number }): React.JSX.Element {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.4, { duration: 400 })),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [delay, opacity]);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: -2 * opacity.value }],
  }));
  return (
    <Animated.View style={[styles.dot, { backgroundColor: theme.colors.primaryText }, animated]} />
  );
}
export function TypingDots(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      accessibilityLabel="Typing"
      style={[styles.bubble, { backgroundColor: theme.colors.bubbleIn }]}
    >
      {[0, 140, 280].map((delay) => (
        <Dot key={delay} delay={delay} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.tail,
  },
  dot: { width: 6, height: 6, borderRadius: radius.full },
});
