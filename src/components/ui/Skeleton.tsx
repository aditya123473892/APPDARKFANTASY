import { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';

export function Skeleton({ style }: { style?: ViewStyle }): React.JSX.Element {
  const opacity = useSharedValue(0.35);
  const { theme } = useTheme();
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[styles.base, { backgroundColor: theme.colors.surfaceMuted }, animated, style]}
    />
  );
}
const styles = StyleSheet.create({ base: { height: 18, borderRadius: 10 } });
