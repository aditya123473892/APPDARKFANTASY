import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  filled?: boolean;
  size?: number;
};

export function IconButton({ icon, label, onPress, active, filled, size = 22 }: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const press = (): void => { void Haptics.selectionAsync(); onPress(); };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press}
      style={({ pressed }) => [styles.base, filled && { backgroundColor: theme.colors.surfaceElevated }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={size} color={active ? theme.colors.primary : theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: spacing.touch, height: spacing.touch, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
