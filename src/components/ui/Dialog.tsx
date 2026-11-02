import { Modal, StyleSheet, View, type AlertButton } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/ui/Pressable';
import { Button } from './Button';
import { Text } from './Text';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useDialogStore } from './dialogStore';

const isCancel = (button: AlertButton) => button.style === 'cancel';
/** React Native types onPress loosely; dialogs never pass it a value. */
const pressed = (button?: AlertButton) => () => (button?.onPress as (() => void) | undefined)?.();

/** Renders the dialog at the front of the queue. Mounted once at the root. */
export function DialogHost(): React.JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const current = useDialogStore((state) => state.queue[0]);
  const last = useDialogStore((state) => state.last);
  const item = current ?? last;

  const close = (then?: () => void) => {
    useDialogStore.getState().shift();
    then?.();
  };
  // Tapping outside or the back button counts as "Cancel", as on iOS.
  const dismiss = () => {
    if (!item || item.options?.cancelable === false) return;
    close(() => {
      pressed(item.buttons.find(isCancel))();
      item.options?.onDismiss?.();
    });
  };

  const choices = item?.buttons.filter((button) => !isCancel(button)) ?? [];
  const cancel = item?.buttons.find(isCancel);
  const sheet = Boolean(item && !item.message && choices.length > 1);

  return (
    <Modal
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      visible={Boolean(current)}
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          sheet ? styles.bottom : styles.center,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <Pressable accessibilityLabel="Close" onPress={dismiss} style={StyleSheet.absoluteFill} />
        {item && sheet ? (
          <Animated.View
            key={item.id}
            entering={SlideInDown.duration(220)}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                paddingBottom: spacing.lg + insets.bottom,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            <Text variant="caption" color="muted" center style={styles.sheetTitle}>
              {item.title}
            </Text>
            {choices.map((button, index) => (
              <Pressable
                key={`${button.text}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={button.text}
                onPress={() => close(pressed(button))}
                style={({ pressed }) => [
                  styles.option,
                  { borderTopColor: theme.colors.divider },
                  index === 0 && styles.firstOption,
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <Text
                  variant="label"
                  weight="medium"
                  color={button.style === 'destructive' ? 'danger' : 'default'}
                  center
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
            <Button
              label={cancel?.text ?? 'Cancel'}
              variant="secondary"
              onPress={() => close(pressed(cancel))}
              style={styles.sheetCancel}
            />
          </Animated.View>
        ) : item ? (
          <Animated.View
            key={item.id}
            entering={FadeIn.duration(160)}
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text variant="heading">{item.title}</Text>
            {item.message ? (
              <Text color="secondary" style={styles.message}>
                {item.message}
              </Text>
            ) : null}
            <View style={item.buttons.length === 2 ? styles.row : styles.column}>
              {/* Cancel first: on the left in a row, at the bottom when stacked. */}
              {(item.buttons.length === 2
                ? [...item.buttons].sort((a, b) => Number(isCancel(b)) - Number(isCancel(a)))
                : [...choices, ...(cancel ? [cancel] : [])]
              ).map((button, index) => (
                <Button
                  key={`${button.text}-${index}`}
                  label={button.text ?? 'OK'}
                  variant={
                    isCancel(button)
                      ? 'secondary'
                      : button.style === 'destructive'
                        ? 'danger'
                        : 'primary'
                  }
                  size="md"
                  fullWidth={item.buttons.length !== 2}
                  style={item.buttons.length === 2 ? styles.grow : undefined}
                  onPress={() => close(pressed(button))}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  center: { justifyContent: 'center', paddingHorizontal: spacing.xl },
  bottom: { justifyContent: 'flex-end' },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  message: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  column: { gap: spacing.sm },
  grow: { flex: 1 },
  sheet: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  sheetTitle: { marginBottom: spacing.sm },
  option: {
    minHeight: spacing.touch,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  firstOption: { borderTopWidth: 0 },
  sheetCancel: { marginTop: spacing.md },
});
