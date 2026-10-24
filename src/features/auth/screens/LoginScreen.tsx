import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text, Wordmark, Button } from '@/components/ui';
import { useRouter, type Href } from 'expo-router';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { SocialButtons } from '../components/SocialButtons';
import { phoneAuth } from '../services/phoneAuth';
import { completePhoneSignIn } from '../phoneSignIn';
import { spacing } from '@/theme';

/** Mobile sign-in is phone number + SMS code only (enforced by the backend too). */
export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  useScreenshotProtection('login');
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Welcome back" back />
      <Wordmark large />
      <View style={styles.copy}>
        <Text variant="display" center>
          A little mystery.{'\n'}A real connection.
        </Text>
        <Text color="muted" center>
          Sign in with your phone number.
        </Text>
      </View>
      <PhoneOtpFlow
        sendCode={phoneAuth.sendLoginCode}
        verifyCode={(phone, code) => completePhoneSignIn(() => phoneAuth.verifyLoginCode(phone, code))}
        verifyLabel="Sign in"
        phoneHint="If this number is linked to an account, we'll text you a 6-digit code."
      />
      <View style={styles.links}>
        <Button
          label="Used email to sign in before? Set up phone sign-in"
          variant="ghost"
          onPress={() => router.push('/phone-setup' as Href)}
        />
        <Button label="New here? Create an account" variant="ghost" onPress={() => router.push('/register')} />
        <Button
          label="Open offline Photo Vault"
          variant="ghost"
          onPress={() => router.push('/vault' as Href)}
        />
      </View>
      <View style={styles.social}>
        <Text variant="caption" color="muted" center>
          OR CONTINUE WITH
        </Text>
        <SocialButtons />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: spacing.sm, marginTop: spacing.xxxl, marginBottom: spacing.xxxl },
  links: { gap: spacing.xs, marginTop: spacing.lg },
  social: { gap: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl },
});
