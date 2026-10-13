import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg },
});
