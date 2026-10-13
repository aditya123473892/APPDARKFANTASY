import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { Header, Screen } from '@/components/layout';
import { Button, Input, Text } from '@/components/ui';
import { forgotPasswordSchema } from '../schemas/authSchemas';
import { authService } from '../services';
type Values = z.infer<typeof forgotPasswordSchema>;
export function ForgotPasswordScreen(): React.JSX.Element {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const submit = async (values: Values): Promise<void> => {
    setLoading(true);
    await authService.requestPasswordReset(values.email);
    setLoading(false);
    setSent(true);
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
        <Button label="Send reset link" loading={loading} onPress={handleSubmit(submit)} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: 18, marginTop: 28 } });
