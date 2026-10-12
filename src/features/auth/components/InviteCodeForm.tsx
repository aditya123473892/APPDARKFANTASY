import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Text } from '@/components/ui';
import { authService } from '../services';
export function InviteCodeForm(): React.JSX.Element {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const submit = async (): Promise<void> => {
    setLoading(true);
    const valid = await authService.validateInviteCode(code);
    setLoading(false);
    if (!valid) {
      setError('That invite code is not valid. Check it and try again.');
      return;
    }
    router.push('/register');
  };
  return (
    <View style={styles.form}>
      <Input
        label="Invite code"
        icon="ticket-outline"
        autoCapitalize="characters"
        value={code}
        onChangeText={(value) => {
          setCode(value.replace(/[^a-zA-Z0-9]/g, ''));
          setError(null);
        }}
        error={error ?? undefined}
      />
      <Text variant="caption" color="muted">
        Mock code: NIGHT42
      </Text>
      <Button label="Continue" loading={loading} onPress={submit} />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 } });
