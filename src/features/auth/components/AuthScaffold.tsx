import type { ReactNode } from 'react';
import type { Href } from 'expo-router';
import { Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * Shared frame for the auth screens: back arrow, one large serif headline with a
 * short subtitle, the form, then a single footer prompt pinned to the bottom.
 */
export function AuthScaffold({
  title,
  subtitle,
  backFallback = '/welcome',
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  backFallback?: Href;
  footer?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      {/* Tapping outside a field dismisses the keyboard; not a screen-reader target. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.page}>
          <View>
            <Header title={title} content={<View />} back backFallback={backFallback} />
            <View style={styles.copy}>
              <Text serif accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text color="secondary">{subtitle}</Text> : null}
            </View>
            {children}
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </TouchableWithoutFeedback>
    </Screen>
  );
}

/** "Question? Action" line used at the bottom of auth screens. */
export function AuthPrompt({
  question,
  action,
  onPress,
}: {
  question: string;
  action: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.prompt}>
      <Text color="muted">{question} </Text>
      <Pressable accessibilityRole="link" hitSlop={12} onPress={onPress}>
        <Text color="primary" weight="semibold">
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

/** Quiet inline text link, e.g. "Forgot password?". */
export function AuthLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable accessibilityRole="link" hitSlop={12} onPress={onPress} style={styles.link}>
      <Text variant="label" color="primary" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'space-between', gap: spacing.xl },
  copy: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xxl },
  title: { fontSize: 34, lineHeight: 42, letterSpacing: -0.5 },
  footer: { paddingVertical: spacing.lg },
  prompt: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
});
