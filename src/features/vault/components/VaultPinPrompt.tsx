import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Text, TextField } from '@/components/ui';
import { PIN_PATTERN, usePinPrompt } from '../pin';

/** Answers `requestPin()` from anywhere in the app. The PIN is never stored in state after submit. */
export function VaultPinPrompt(): React.JSX.Element {
  const prompt = usePinPrompt((state) => state.prompt);
  const error = usePinPrompt((state) => state.error);
  const [pin, setPin] = useState('');
  const cancel = () => {
    setPin('');
    prompt?.reject(new Error('Unlock cancelled.'));
  };
  const submit = () => {
    if (!PIN_PATTERN.test(pin)) return;
    const value = pin;
    setPin('');
    prompt?.resolve(value);
  };
  return (
    <Modal visible={!!prompt} title="Enter vault PIN" onClose={cancel}>
      <View style={styles.body}>
        <TextField
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          maxLength={8}
          textContentType="oneTimeCode"
          autoComplete="off"
          accessibilityLabel="Vault PIN"
          placeholder="4–8 digits"
          onSubmitEditing={submit}
        />
        {!!error && (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        )}
        <Button
          label="Unlock"
          icon="lock-open-outline"
          disabled={!PIN_PATTERN.test(pin)}
          onPress={submit}
        />
        <Button label="Cancel" variant="ghost" onPress={cancel} />
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({ body: { gap: 12 } });
