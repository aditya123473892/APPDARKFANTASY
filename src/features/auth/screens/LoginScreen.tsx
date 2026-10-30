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

export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const login = async () => {
    if (busy.current) return;
    if (!identifier.trim() || !password) {
      setError('Enter your email or mobile number and password.');
      return;
    }
    busy.current = true;
    setLoading(true);
    setError(null);
    const secret = password;
    setPassword('');
    try {
      await completePhoneSignIn(() => phoneAuth.loginWithPassword(identifier, secret));
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
        method === 'password'
          ? 'Sign in with your email or mobile number and password.'
          : 'Get a one-time code on your mobile number.'
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
        <View style={styles.methods}>
          <Button
            label="Password"
            fullWidth={false}
            style={{ flex: 1 }}
            variant={method === 'password' ? 'primary' : 'ghost'}
            disabled={loading}
            onPress={() => {
              setMethod('password');
              setError(null);
            }}
          />
          <Button
            label="Mobile OTP"
            fullWidth={false}
            style={{ flex: 1 }}
            variant={method === 'otp' ? 'primary' : 'ghost'}
            disabled={loading}
            onPress={() => {
              setMethod('otp');
              setPassword('');
              setError(null);
            }}
          />
        </View>
        {method === 'password' ? (
          <>
            <Input
              label="Email or mobile number"
              placeholder="Email or +91 mobile number"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
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
  methods: { flexDirection: 'row', gap: spacing.sm },
});
