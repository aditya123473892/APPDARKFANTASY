import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** Compact pill search used at the top of lists. Clearing is built in. */
export function SearchField({
  value,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="search" size={17} color={theme.colors.textMuted} />
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.primary}
        maxFontSizeMultiplier={typography.maxFontScale}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { color: theme.colors.text }]}
        {...props}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          style={{ alignItems: 'center', justifyContent: 'center' }}
          onPress={() => onChangeText('')}
        >
          <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: spacing.control,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: spacing.touch,
    paddingVertical: spacing.none,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily,
  },
});
