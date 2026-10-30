import { spacing } from '@/theme';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { mobileSignupSchema, type MobileSignupValues } from '../schemas/authSchemas';
import { useRegister } from '../hooks/useRegister';

export function RegisterForm({
  signupToken,
  onSignupExpired,
}: {
  signupToken: string;
  onSignupExpired: () => void;
}): React.JSX.Element {
  const { register, error, isLoading, success } = useRegister(signupToken, onSignupExpired);
  const {
    control,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<MobileSignupValues>({
    resolver: zodResolver(mobileSignupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  if (success)
    return (
      <Text>Account created. Check your email for verification instructions, then sign in.</Text>
    );
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label="Email address"
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordInput
            label="Create password"
            autoComplete="new-password"
            editable={!isLoading}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      <Text variant="caption" color="muted">
        Use at least 8 characters, including an uppercase letter and a number.
      </Text>
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            editable={!isLoading}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.confirmPassword?.message}
          />
        )}
      />
      {error ? (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        label="Create account"
        loading={isLoading}
        onPress={handleSubmit(async ({ email, password }) => {
          const request = register({ email, password });
          resetField('password');
          resetField('confirmPassword');
          await request;
        })}
      />
      <Button
        label="Change mobile number"
        variant="ghost"
        disabled={isLoading}
        onPress={onSignupExpired}
      />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: spacing.lg } });
