import { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useContentInsets } from './useContentInsets';

/**
 * Base screen container. Applies safe-area insets (status bar, cutouts, gesture bar),
 * the app background, and caps content width so layouts stay readable on tablets
 * and unfolded foldables. Tab screens omit the bottom edge because the tab bar owns it.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges,
  style,
}: PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}>): React.JSX.Element {
  const { theme } = useTheme();
  const insets = useContentInsets();
  const contentStyle = [
    styles.content,
    padded && styles.padded,
    scroll && { paddingBottom: insets.bottom },
    style,
  ];
  return (
    <SafeAreaView
      edges={
        edges ?? (insets.inTabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom'])
      }
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      {scroll ? (
        // Edge-to-edge Android no longer resizes for the keyboard, so pad on both platforms.
        <KeyboardAvoidingView behavior="padding" style={styles.safe}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentStyle}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: spacing.contentMax, alignSelf: 'center' },
  padded: { paddingHorizontal: spacing.screen },
});
