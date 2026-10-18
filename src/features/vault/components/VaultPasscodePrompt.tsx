import { useState } from 'react';
import { AppState, Modal, TextInput, View } from 'react-native';
import { create } from 'zustand';
import { Button, Text } from '@/components/ui';
import { unlock, lock, noDeviceLock } from '../lock';

type Prompt = { owner: string | null; resolve: (() => void) | null; reject: (() => void) | null };
const prompt = create<Prompt>(() => ({ owner: null, resolve: null, reject: null }));
function cancel() {
  if (prompt.getState().owner) lock();
  prompt.getState().reject?.();
  prompt.setState({ owner: null, resolve: null, reject: null });
}
AppState.addEventListener('change', (s) => {
  if (s !== 'active') cancel();
});
export async function requestUnlock(owner: string): Promise<void> {
  if (!(await noDeviceLock())) return unlock(owner);
  if (prompt.getState().owner) throw new Error('Unlock is already in progress.');
  return new Promise<void>((resolve, reject) =>
    prompt.setState({
      owner,
      resolve,
      reject: () =>
        reject(new Error('Unlock cancelled. Open Photo Vault to configure an app passcode.')),
    }),
  );
}
export function VaultPasscodePrompt(): React.JSX.Element {
  const state = prompt();
  return state.owner ? <PasscodeDialog key={state.owner} state={state} /> : <></>;
}
function PasscodeDialog({ state }: { state: Prompt }): React.JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={!!state.owner} transparent onRequestClose={cancel}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: '#100b16',
          padding: 24,
          gap: 16,
        }}
      >
        <Text>Unlock Photo Vault to prepare this photo.</Text>
        <TextInput
          accessibilityLabel="Vault app passcode"
          secureTextEntry
          keyboardType="number-pad"
          value={value}
          onChangeText={setValue}
          style={{ color: '#fff', padding: 16, borderColor: '#888', borderWidth: 1 }}
        />
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        <Button
          label="Unlock"
          disabled={busy}
          onPress={() => {
            if (!state.owner) return;
            setBusy(true);
            setError('');
            void unlock(state.owner, value)
              .then(() => {
                state.resolve?.();
                prompt.setState({ owner: null, resolve: null, reject: null });
              })
              .catch(() =>
                setError(
                  'Could not unlock. If no passcode is configured, open Photo Vault to set one up.',
                ),
              )
              .finally(() => {
                setValue('');
                setBusy(false);
              });
          }}
        />
        <Button
          label="Cancel"
          onPress={() => {
            setValue('');
            cancel();
          }}
        />
      </View>
    </Modal>
  );
}
