import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const NativePressable = Animated.createAnimatedComponent(Pressable);
/** Shared, reduced-motion-aware touch feedback. */
export function AnimatedPressable({
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <NativePressable
      {...props}
      style={[style, animated]}
      onPressIn={(event) => {
        scale.set(withTiming(0.97, { duration: 100 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: 140 }));
        onPressOut?.(event);
      }}
    />
  );
}
