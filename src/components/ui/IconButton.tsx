import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  filled?: boolean;
  size?: number;
  /** Shows a small pink dot, e.g. for unread content. */
  dot?: boolean;
  disabled?: boolean;
};

export function IconButton({
  icon,
  label,
  onPress,
  active,
  filled,
  size = 22,
  dot,
  disabled,
}: IconButtonProps): React.JSX.Element {
  const { theme } = useTheme();
  const press = (): void => {
    void Haptics.selectionAsync();
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [
        styles.base,
        filled && { backgroundColor: theme.colors.surfaceElevated },
        pressed && { backgroundColor: theme.colors.surfacePressed },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={size} color={active ? theme.colors.primary : theme.colors.text} />
      {dot ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.background },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: spacing.touch - 4,
    height: spacing.touch - 4,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 2,
  },
});
