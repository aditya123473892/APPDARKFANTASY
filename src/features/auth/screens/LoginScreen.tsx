import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLink, AuthPrompt, AuthScaffold } from '../components/AuthScaffold';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { phoneAuth, phoneErrorMessage } from '../services/phoneAuth';
import { completePhoneSignIn } from '../phoneSignIn';
import { spacing } from '@/theme';
import { useRef, useState } from 'react';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { featureFlags } from '@/config/featureFlags';
import { signupEmailSchema } from '../schemas/authSchemas';

export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const login = async () => {
    if (busy.current) return;
    const email = signupEmailSchema.safeParse(identifier);
    if (!email.success || !password) {
      setError('Enter a valid email address and your password.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    const secret = password;
    setPassword('');
    try {
      await completePhoneSignIn(() => phoneAuth.loginWithPassword(email.data, secret));
    } catch (caught) {
      setError(phoneErrorMessage(caught));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  const resendEmail = async () => {
    if (busy.current) return;
    if (!identifier.includes('@') || !password) {
      setError('Enter your account email and password above to resend verification.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    const secret = password;
    setPassword('');
    try {
      await phoneAuth.resendVerification(identifier, secret);
      setNotice('Check your email for a verification link, then sign in.');
    } catch (caught) {
      setError(phoneErrorMessage(caught));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  useScreenshotProtection('login');
  return (
    <AuthScaffold
      title="Welcome back"
      subtitle={
        featureFlags.PHONE_AUTH_REQUIRED
          ? 'Get a one-time code on your mobile number.'
          : 'Sign in with your email and password.'
      }
      footer={
        <AuthPrompt
          question="New here?"
          action="Create an account"
          onPress={() => router.replace('/register')}
        />
      }
    >
      <View style={styles.form}>
        {!featureFlags.PHONE_AUTH_REQUIRED ? (
          <>
            <Input
              label="Email address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
              value={identifier}
              onChangeText={setIdentifier}
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              editable={!loading}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void login()}
            />
            {error ? (
              <Text color="danger" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Button label="Sign in" loading={loading} onPress={() => void login()} />
            <Button
              label="Resend verification email"
              variant="ghost"
              disabled={loading}
              onPress={() => void resendEmail()}
            />
            {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
          </>
        ) : (
          <PhoneOtpFlow
            sendCode={phoneAuth.sendLoginCode}
            verifyCode={(phone, code) =>
              completePhoneSignIn(() => phoneAuth.verifyLoginCode(phone, code))
            }
            sendLabel="Continue"
            verifyLabel="Sign in"
            autoFocus={false}
          />
        )}
        <AuthLink label="Forgot password?" onPress={() => router.push('/forgot-password')} />
      </View>
    </AuthScaffold>
  );
}
const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
