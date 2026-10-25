import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { BottomSheet, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { MESSAGE_TIMERS } from '../disappearing';

/** Picks the disappearing-message timer for the messages the viewer sends next. */
export function TimerSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  onChange: (seconds: number | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const options = [{ seconds: null, label: 'Off' }, ...MESSAGE_TIMERS];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.copy}>
        <Text variant="heading">Disappearing messages</Text>
        <Text color="muted">
          New messages you send are deleted for everyone once the timer runs out, counted from when
          they are sent. People can still copy or screenshot them before then.
        </Text>
      </View>
      <View>
        {options.map((option) => {
          const selected = option.seconds === value;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(option.seconds);
                onClose();
              }}
              style={({ pressed }) => [
                styles.option,
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <Text weight={selected ? 'semibold' : undefined}>{option.label}</Text>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  copy: { gap: spacing.sm },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
