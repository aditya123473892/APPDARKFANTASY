import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Input, PasswordInput, Text } from '@/components/ui';
import { registerSchema, type RegisterValues } from '../schemas/authSchemas';
import { useRegister } from '../hooks/useRegister';
export function RegisterForm(): React.JSX.Element {
  const { register, error, isLoading, success } = useRegister();
  const {
    control,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', lastName: '', age: '', gender: '', email: '', password: '' },
  });
  if (success)
    return (
      <Text>Account created. Check your email for verification instructions, then sign in.</Text>
    );
  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="First name"
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
        name="lastName"
        render={({ field }) => (
          <Input
            label="Last name"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.lastName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="age"
        render={({ field }) => (
          <Input
            label="Age"
            keyboardType="number-pad"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.age?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <Input
            label="Gender"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.gender?.message}
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
        onPress={handleSubmit(async (values) => {
          const request = register(values);
          resetField('password');
          await request;
        })}
      />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 } });
