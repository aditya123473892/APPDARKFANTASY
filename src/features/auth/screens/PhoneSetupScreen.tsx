import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { spacing } from '@/theme';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { completePhoneSignIn } from '../phoneSignIn';
import { loginSchema } from '../schemas/authSchemas';
import { phoneAuth, phoneErrorMessage } from '../services/phoneAuth';
import { AuthError } from '../types';

/**
 * One-time move to phone sign-in for accounts created with email + password:
 * confirm the password once, then add and verify a phone number. The password
 * proof only lets this screen add a phone; it is never a session.
 */
export function PhoneSetupScreen(): React.JSX.Element {
  const router = useRouter();
  useScreenshotProtection('login');
  const [bootstrapToken, setBootstrapToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(false);
  const password = useRef('');
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        password.current = '';
        input.current?.clear();
      }
    });
    return () => {
      password.current = '';
      listener.remove();
    };
  }, []);

  const confirmPassword = async () => {
    if (loading) return;
    const parsed = loginSchema.safeParse({ email, password: password.current });
    password.current = '';
    input.current?.clear();
    if (!parsed.success) {
      setError('Enter the email and password you used before.');
      return;
    }
    setLoading(true);
    setError(null);
    setLinked(false);
    try {
      setBootstrapToken(await phoneAuth.startPhoneSetup(parsed.data.email, parsed.data.password));
    } catch (caught) {
      setLinked(caught instanceof AuthError && caught.code === 'PHONE_ALREADY_LINKED');
      setError(phoneErrorMessage(caught));
    } finally {
      parsed.data.password = '';
      setLoading(false);
    }
  };

  // The setup token lasts 15 minutes; when it lapses, start again from the password.
  const withToken = async <T,>(task: (token: string) => Promise<T>): Promise<T> => {
    try {
      return await task(bootstrapToken!);
    } catch (caught) {
      if (caught instanceof AuthError && caught.code === 'INVALID_CREDENTIALS') {
        setBootstrapToken(null);
        setError('Your setup session expired. Confirm your password again.');
      }
      throw caught;
    }
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Set up phone sign-in" back backFallback="/login" />
      <View style={styles.copy}>
        <Text variant="title" center>
          {bootstrapToken ? 'Add your phone number' : 'Confirm it’s you'}
        </Text>
        <Text color="muted" center>
          {bootstrapToken
            ? 'From now on you’ll sign in to the app with this number and a code we text you.'
            : 'The app now uses phone sign-in. Confirm your existing account once to add your number.'}
        </Text>
      </View>
      {bootstrapToken ? (
        <PhoneOtpFlow
          sendCode={(phone) => withToken((token) => phoneAuth.sendLinkCode(phone, token))}
          verifyCode={(phone, code) =>
            completePhoneSignIn(() =>
              withToken(async (token) => {
                const result = await phoneAuth.verifyLinkCode(phone, code, token);
                if (!result) throw new AuthError('SERVER');
                return result;
              }),
            )
          }
          verifyLabel="Verify and sign in"
        />
      ) : (
        <View style={styles.form}>
          <Input
            label="Email"
            icon="mail-outline"
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <PasswordInput
            ref={input}
            label="Password"
            autoComplete="current-password"
            textContentType="password"
            editable={!loading}
            onChangeText={(value) => {
              password.current = value;
            }}
            onSubmitEditing={() => void confirmPassword()}
          />
          {error ? (
            <Text
              color="danger"
              variant="label"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}
          {linked ? (
            <Button label="Sign in with phone" onPress={() => router.replace('/login')} />
          ) : (
            <Button label="Continue" loading={loading} onPress={() => void confirmPassword()} />
          )}
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xxl },
  form: { gap: spacing.lg },
});
