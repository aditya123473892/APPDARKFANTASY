import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { loginSchema, type LoginValues } from '../schemas/authSchemas';
import { useLogin } from '../hooks/useLogin';

export function LoginForm(): React.JSX.Element {
  const { login, error, isLoading, cooldown } = useLogin();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'demo@example.com', password: 'DemoPass1' },
  });
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label="Email"
            icon="mail-outline"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            value={field.value}
            onBlur={field.onBlur}
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
            label="Password"
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      <Link href="/forgot-password" asChild>
        <Text color="primary" variant="label" style={styles.link}>
          Forgot password?
        </Text>
      </Link>
      {error ? (
        <Text color="danger" variant="label">
          {error}
        </Text>
      ) : null}
      <Button
        label={cooldown > 0 ? `Try again in ${cooldown}s` : 'Sign in'}
        disabled={cooldown > 0}
        loading={isLoading}
        onPress={handleSubmit((values) =>
          login(values.email, values.password).then(() => undefined),
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 }, link: { alignSelf: 'flex-end' } });
