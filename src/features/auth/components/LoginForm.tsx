import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TextInput, View } from 'react-native';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { loginSchema } from '../schemas/authSchemas';
import { useLogin } from '../hooks/useLogin';

export function LoginForm(): React.JSX.Element {
  const { login, error, isLoading, cooldown } = useLogin();
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const password = useRef('');
  const input = useRef<TextInput>(null);
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
  const submit = () => {
    if (isLoading || cooldown > 0) return;
    const parsed = loginSchema.safeParse({ email, password: password.current });
    password.current = '';
    input.current?.clear();
    if (!parsed.success) {
      setValidationError('Enter a valid email and your password.');
      return;
    }
    setValidationError(null);
    void login(parsed.data.email, parsed.data.password);
    parsed.data.password = '';
  };
  return (
    <View style={styles.form}>
      <Input
        label="Email"
        icon="mail-outline"
        keyboardType="email-address"
        autoComplete="username"
        textContentType="username"
        autoCorrect={false}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!isLoading}
      />
      <PasswordInput
        ref={input}
        label="Password"
        autoComplete="current-password"
        textContentType="password"
        importantForAutofill="yes"
        editable={!isLoading}
        onChangeText={(value) => {
          password.current = value;
        }}
        onSubmitEditing={submit}
      />
      {validationError || error ? (
        <Text color="danger" variant="label">
          {validationError ?? error}
        </Text>
      ) : null}
      <Button
        label={cooldown > 0 ? `Try again in ${cooldown}s` : 'Sign in'}
        disabled={cooldown > 0}
        loading={isLoading}
        onPress={submit}
      />
      <Text color="muted" variant="caption">
        For account creation or password reset, use the desktop website.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 } });
