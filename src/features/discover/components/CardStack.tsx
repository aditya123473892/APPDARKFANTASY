import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { EmptyState, Text } from '@/components/ui';
import type { ProfileView } from '@/features/profile/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { SwipeCard } from './SwipeCard';

export type SwipeAction = 'pass' | 'like' | 'super';
export type CardStackHandle = { act: (action: SwipeAction) => void };

const SWIPE_THRESHOLD = 110;

export const CardStack = forwardRef<
  CardStackHandle,
  {
    profiles: ProfileView[];
    showDistance: boolean;
    showPresence: boolean;
    onSwipe: (profile: ProfileView, action: SwipeAction) => void;
    onEmptyAction: () => void;
  }
>(function CardStack({ profiles, showDistance, showPresence, onSwipe, onEmptyAction }, ref) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // Track handled profiles by id (not index) so refetches that reorder/remove people never skip anyone.
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const remaining = useMemo(
    () => profiles.filter((profile) => !seen.has(profile.id)),
    [profiles, seen],
  );
  const current = remaining[0];
  const next = remaining[1];
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const throwDistance = width * 1.3;

  const complete = (profileId: string, action: SwipeAction): void => {
    const profile = profiles.find((item) => item.id === profileId);
    setSeen((value) => new Set(value).add(profileId));
    x.value = 0;
    y.value = 0;
    if (profile) onSwipe(profile, action);
  };

  const act = (action: SwipeAction): void => {
    if (!current) return;
    const id = current.id;
    const target = action === 'pass' ? -throwDistance : throwDistance;
    if (action === 'super') y.value = withTiming(-throwDistance, { duration: 260 });
    x.value = withTiming(action === 'super' ? 0 : target, { duration: 240 }, (finished) => {
      if (finished) scheduleOnRN(complete, id, action);
    });
  };
  useImperativeHandle(ref, () => ({ act }));

  const currentId = current?.id ?? '';
  const pan = Gesture.Pan()
    .enabled(Boolean(current))
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY * 0.25;
    })
    .onEnd((event) => {
      const passed =
        Math.abs(event.translationX) > SWIPE_THRESHOLD || Math.abs(event.velocityX) > 900;
      if (passed) {
        const direction = event.translationX > 0 ? 1 : -1;
        x.value = withTiming(direction * throwDistance, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(complete, currentId, direction > 0 ? 'like' : 'pass');
        });
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, width], [-12, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const behindStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(x.value),
      [0, SWIPE_THRESHOLD * 2],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale: 0.94 + progress * 0.06 }], opacity: 0.6 + progress * 0.4 };
  });

  if (!current)
    return (
      <EmptyState
        icon="moon-outline"
        title="You've seen everyone for now"
        message="New people join every day. Check back soon, or browse the list view."
        actionLabel={seen.size ? 'Review passed profiles' : 'Browse people'}
        onAction={() => {
          if (seen.size) setSeen(new Set());
          else onEmptyAction();
        }}
      />
    );

  return (
    <View style={styles.stack}>
      {next ? (
        <Animated.View style={[styles.card, behindStyle]} pointerEvents="none">
          <SwipeCard profile={next} showDistance={showDistance} showPresence={showPresence} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View
          key={current.id}
          style={[styles.card, cardStyle]}
          accessible
          accessibilityLabel={`${current.name}, ${current.age}. ${current.bio}`}
          accessibilityHint="Use the buttons below to pass or connect"
        >
          <SwipeCard profile={current} showDistance={showDistance} showPresence={showPresence} />
          <Animated.View
            style={[
              styles.stamp,
              styles.stampLike,
              { borderColor: theme.colors.primary },
              likeStyle,
            ]}
          >
            <Text variant="heading" color="primary">
              CONNECT
            </Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.stamp,
              styles.stampPass,
              { borderColor: theme.colors.textSecondary },
              passStyle,
            ]}
          >
            <Text variant="heading" color="secondary">
              PASS
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  stack: { flex: 1 },
  card: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  stamp: {
    position: 'absolute',
    top: spacing.xxl,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stampLike: { left: spacing.xl, transform: [{ rotate: '-12deg' }] },
  stampPass: { right: spacing.xl, transform: [{ rotate: '12deg' }] },
});
