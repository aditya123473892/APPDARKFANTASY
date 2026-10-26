import { spacing } from '@/theme';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { z } from 'zod';
import { Button, Input, Text } from '@/components/ui';
import { AuthLink, AuthPrompt, AuthScaffold } from '../components/AuthScaffold';
import { forgotPasswordSchema } from '../schemas/authSchemas';
import { authService } from '../services';
import { AuthError } from '../types';
type Values = z.infer<typeof forgotPasswordSchema>;
export function ForgotPasswordScreen(): React.JSX.Element {
  const router = useRouter();
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
    <AuthScaffold
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      backFallback="/login"
      footer={
        <AuthPrompt
          question="Signed up with email?"
          action="Set up phone sign-in"
          onPress={() => router.push('/phone-setup' as Href)}
        />
      }
    >
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
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
          <Text color="success" accessibilityRole="alert">
            If that email is registered, a reset link is on its way.
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
        <AuthLink label="Back to sign in" onPress={() => router.replace('/login')} />
      </View>
    </AuthScaffold>
  );
}
const styles = StyleSheet.create({ form: { gap: spacing.lg } });
