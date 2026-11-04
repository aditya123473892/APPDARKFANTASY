import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

/**
 * The bottom safe-area space under a composer, shrinking to nothing as the keyboard
 * opens and growing back as it closes, frame by frame with the keyboard. Switching a
 * fixed padding on "keyboard shown/hidden" events made the input jump twice.
 */
export function KeyboardInsetSpacer({
  inset,
  color,
}: {
  inset: number;
  /** The composer's background, so the space reads as part of it. */
  color?: string;
}): React.JSX.Element {
  const { progress } = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => ({
    height: Math.max(0, inset * (1 - progress.value)),
  }));
  return <Animated.View style={[style, color ? { backgroundColor: color } : null]} />;
}
