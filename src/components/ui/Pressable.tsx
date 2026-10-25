import { forwardRef, type ComponentRef } from 'react';
import { Pressable as NativePressable, type PressableProps, StyleSheet } from 'react-native';
import { spacing } from '@/theme';

/** Consistent feedback and a 44dp minimum target for native touchables. */
export const Pressable = forwardRef<ComponentRef<typeof NativePressable>, PressableProps>(
  function Pressable({ style, ...props }, ref) {
    return (
      <NativePressable
        ref={ref}
        {...props}
        style={(state) => {
          const resolved = typeof style === 'function' ? style(state) : style;
          const flat = StyleSheet.flatten(resolved);
          return [
            styles.target,
            resolved,
            {
              minWidth:
                typeof flat?.minWidth === 'number'
                  ? Math.max(spacing.touchMin, flat.minWidth)
                  : (flat?.minWidth ?? spacing.touchMin),
              minHeight:
                typeof flat?.minHeight === 'number'
                  ? Math.max(spacing.touchMin, flat.minHeight)
                  : (flat?.minHeight ?? spacing.touchMin),
            },
            state.pressed && styles.pressed,
          ];
        }}
      />
    );
  },
);
const styles = StyleSheet.create({
  target: { minWidth: spacing.touchMin, minHeight: spacing.touchMin },
  pressed: { opacity: 0.72 },
});
