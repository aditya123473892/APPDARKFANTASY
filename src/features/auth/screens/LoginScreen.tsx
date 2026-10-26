import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Card, Divider, Text, Wordmark } from '@/components/ui';
import { useRouter, type Href } from 'expo-router';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { SocialButtons } from '../components/SocialButtons';
import { phoneAuth } from '../services/phoneAuth';
import { completePhoneSignIn } from '../phoneSignIn';
import { spacing } from '@/theme';

/**
 * Mobile sign-in is phone number + SMS code only (enforced by the backend too).
 * Brand, then welcome copy, then the form card, then secondary actions pinned
 * toward the bottom on tall screens; everything scrolls on small ones.
 */
export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  useScreenshotProtection('login');
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      {/* Tapping outside a field dismisses the keyboard; not a screen-reader target. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.page}>
          <View>
            {/* Back only; the welcome title below is the screen's heading. */}
            <Header title="Sign in" content={<View />} back backFallback="/welcome" />
            <Wordmark large />
            <View style={styles.copy}>
              <Text variant="title" center accessibilityRole="header">
                Welcome back
              </Text>
              <Text color="muted" center>
                Sign in with your mobile number. We'll text you a 6-digit code.
              </Text>
            </View>
            <Card style={styles.card}>
              <PhoneOtpFlow
                sendCode={phoneAuth.sendLoginCode}
                verifyCode={(phone, code) =>
                  completePhoneSignIn(() => phoneAuth.verifyLoginCode(phone, code))
                }
                sendLabel="Continue"
                verifyLabel="Sign in"
                phoneHint="If this number is linked to an account, we'll text you a code."
                autoFocus={false}
              />
            </Card>
          </View>
          <View style={styles.secondary}>
            <View style={styles.signup}>
              <Text color="muted">New here?</Text>
              <Button
                label="Create an account"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => router.push('/register')}
              />
            </View>
            <Button
              label="Used email before? Set up phone sign-in"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/phone-setup' as Href)}
            />
            <View
              style={styles.or}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.rule}>
                <Divider />
              </View>
              <Text variant="caption" color="muted">
                OR
              </Text>
              <View style={styles.rule}>
                <Divider />
              </View>
            </View>
            <SocialButtons />
            <Button
              label="Open offline Photo Vault"
              icon="lock-closed-outline"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/vault' as Href)}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Screen>
  );
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'space-between', gap: spacing.xl },
  copy: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
  card: { padding: spacing.xl },
  secondary: { gap: spacing.sm, paddingBottom: spacing.lg },
  signup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  rule: { flex: 1 },
});
