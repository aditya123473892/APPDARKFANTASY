import { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { User } from '@/features/auth/types';
import { SwipeCard } from './SwipeCard';
import { EmptyState } from '@/components/feedback/EmptyState';

export type CardStackHandle = { act: (action: 'pass' | 'like' | 'super') => void };

export const CardStack = forwardRef<CardStackHandle, { users: User[] }>(function CardStack(
  { users },
  ref,
) {
  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);
  const rotate = useSharedValue(0);
  const next = (): void => {
    setIndex((value) => value + 1);
    x.value = 0;
    rotate.value = 0;
  };
  const act = (action: 'pass' | 'like' | 'super'): void => {
    x.value = withSpring(action === 'pass' ? -500 : 500, {}, () => runOnJS(next)());
  };
  useImperativeHandle(ref, () => ({ act }));
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      x.value = event.translationX;
      rotate.value = event.translationX / 18;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 110)
        x.value = withSpring(event.translationX > 0 ? 500 : -500, {}, () => runOnJS(next)());
      else {
        x.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: `${rotate.value}deg` }],
  }));
  const user = users[index];
  if (!user)
    return (
      <EmptyState
        icon="moon-outline"
        title="You're all caught up"
        message="Fresh profiles will appear here soon."
        actionLabel="Start over"
        onAction={() => setIndex(0)}
      />
    );
  return (
    <View style={styles.stack}>
      {users[index + 1] ? (
        <View style={[styles.card, styles.behind]}>
          <SwipeCard user={users[index + 1]!} />
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <SwipeCard user={user} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});
const styles = StyleSheet.create({
  stack: { flex: 1 },
  card: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  behind: { transform: [{ scale: 0.94 }, { translateY: 10 }], opacity: 0.65 },
});
