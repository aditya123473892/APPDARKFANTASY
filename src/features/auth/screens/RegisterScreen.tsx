import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text, Wordmark } from '@/components/ui';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { RegisterForm } from '../components/RegisterForm';
import { phoneAuth } from '../services/phoneAuth';

/** Signup verifies the phone first, then collects the profile and creates the account. */
export function RegisterScreen(): React.JSX.Element {
  const [signupToken, setSignupToken] = useState<string | null>(null);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Create account" back />
      <Wordmark large />
      <View style={styles.copy}>
        <Text variant="title" center>
          Meet your next favorite person.
        </Text>
        <Text color="muted" center>
          {signupToken
            ? "Number verified. A few details and you're in."
            : "First, verify your phone number. You'll use it to sign in."}
        </Text>
      </View>
      {signupToken ? (
        <RegisterForm signupToken={signupToken} onSignupExpired={() => setSignupToken(null)} />
      ) : (
        <PhoneOtpFlow
          sendCode={phoneAuth.sendSignupCode}
          verifyCode={async (phone, code) => setSignupToken(await phoneAuth.verifySignupCode(phone, code))}
          verifyLabel="Verify number"
        />
      )}
      <View style={styles.footer}>
        <Text color="muted">Already have an account? </Text>
        <Link href="/login" asChild>
          <Text color="primary" weight="bold">
            Sign in
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: 6, marginTop: 18, marginBottom: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
});
