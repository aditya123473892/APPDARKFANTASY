import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const opacity = useSharedValue(0.45);
  const { theme } = useTheme();
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { backgroundColor: theme.colors.surfaceElevated }, animated, style]}
    />
  );
}
const styles = StyleSheet.create({ base: { height: 16, borderRadius: radius.xs } });
