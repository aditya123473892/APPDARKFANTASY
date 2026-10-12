import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { registerSchema, type RegisterValues } from '../schemas/authSchemas';
import { useRegister } from '../hooks/useRegister';
export function RegisterForm(): React.JSX.Element {
  const { register, error, isLoading } = useRegister();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="Name"
            icon="person-outline"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.name?.message}
          />
        )}
      />
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
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <PasswordInput
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.password?.message}
          />
        )}
      />
      {error ? <Text color="danger">{error}</Text> : null}
      <Button
        label="Create account"
        loading={isLoading}
        onPress={handleSubmit((values) => register(values).then(() => undefined))}
      />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 } });
