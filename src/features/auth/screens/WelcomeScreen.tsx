import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout';
import { Button, IconButton, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { getPrimaryLoginStrategy } from '../strategies/loginStrategies';

/** Brand moment up top, then the two choices that matter: create an account or sign in. */
export function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const strategy = getPrimaryLoginStrategy();
  return (
    <Screen scroll style={styles.root}>
      <View style={styles.top}>
        {/* The offline Photo Vault stays reachable while signed out. */}
        <IconButton
          icon="lock-closed-outline"
          label="Open offline Photo Vault"
          size={20}
          onPress={() => router.push('/vault' as Href)}
        />
      </View>
      <View style={styles.hero}>
        <Text
          serif
          center
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.brand}
        >
          Darkfantasy
        </Text>
        <View style={[styles.rule, { backgroundColor: theme.colors.primary }]} />
        <Text color="secondary" center style={styles.tagline}>
          Real conversations with people worth meeting.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label="Create account"
          onPress={() => router.push('/register')}
          style={styles.pill}
        />
        <Button
          label={strategy.id === 'invite_code' ? 'Enter invite code' : 'Sign in'}
          variant="secondary"
          onPress={() => router.push(strategy.route)}
          style={styles.pill}
        />
        <Text variant="caption" color="muted" center style={styles.legal}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  root: { paddingBottom: spacing.xl },
  top: { alignItems: 'flex-end', paddingTop: spacing.sm },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.huge,
  },
  brand: { fontSize: 44, lineHeight: 54, letterSpacing: -0.5 },
  rule: { width: 32, height: 2, borderRadius: radius.full },
  tagline: { maxWidth: 280, fontSize: 17, lineHeight: 24 },
  actions: { gap: spacing.md },
  pill: { borderRadius: radius.full },
  legal: { marginTop: spacing.sm, paddingHorizontal: spacing.xl },
});
