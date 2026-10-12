import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.base,
        theme.shadows.sm,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}
const styles = StyleSheet.create({ base: { borderWidth: 1, borderRadius: 20, padding: 16 } });
