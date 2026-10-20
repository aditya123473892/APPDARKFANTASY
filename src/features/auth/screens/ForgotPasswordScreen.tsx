import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { Header, Screen } from '@/components/layout';
import { Button, Input, Text } from '@/components/ui';
import { forgotPasswordSchema } from '../schemas/authSchemas';
import { authService } from '../services';
import { AuthError } from '../types';
type Values = z.infer<typeof forgotPasswordSchema>;
export function ForgotPasswordScreen(): React.JSX.Element {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const submit = async (values: Values): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setSent(false);
    setError(null);
    try {
      await authService.requestPasswordReset(values.email);
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof AuthError && caught.code === 'NETWORK'
          ? 'Check your connection and try again.'
          : caught instanceof AuthError && caught.code === 'RATE_LIMITED'
            ? 'Too many requests. Please wait before trying again.'
            : 'Unable to send reset instructions. Please try again.',
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Reset password" back />
      <View style={styles.content}>
        <Text variant="title">Check your inbox</Text>
        <Text color="muted">
          Enter your email. If an account exists, we'll send reset instructions.
        </Text>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              label="Email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
            />
          )}
        />
        {sent ? (
          <Text color="primary" weight="semibold">
            If that email is registered, reset instructions are on the way.
          </Text>
        ) : null}
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button
          label="Send reset link"
          loading={loading}
          onPress={() => void handleSubmit(submit)()}
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: 18, marginTop: 28 } });
