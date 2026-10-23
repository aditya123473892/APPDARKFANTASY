import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, Text, TextField } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { SettingsGroup, SettingsRow } from '@/features/settings/components/SettingsRow';
import { noDeviceLock, setUnlockMethod, unlockMethod, useVaultLock } from '../lock';
import { PIN_PATTERN, type UnlockMethod } from '../pin';
import { initializeVaultOwner } from '../vaultService';
import { vaultError } from '../presentation';

/** Choose how the vault opens: device biometrics (screen-lock fallback) or a vault PIN. */
export function VaultSettingsScreen(): React.JSX.Element {
  useScreenshotProtection('vault-settings');
  const { unlocked, owner: unlockedOwner } = useVaultLock();
  const [owner, setOwner] = useState('');
  const [method, setMethod] = useState<UnlockMethod | null>(null);
  const [noLock, setNoLock] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = unlocked && !!owner && unlockedOwner === owner;

  useEffect(() => {
    void initializeVaultOwner()
      .then(async (user) => {
        setOwner(user);
        setMethod(await unlockMethod(user));
      })
      .catch(() => setError('Sign in to change vault settings.'));
    void noDeviceLock()
      .then(setNoLock)
      .catch(() => setNoLock(true));
  }, []);

  const run = async (work: () => Promise<void>, done: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
      setMethod(await unlockMethod(owner));
      setEditingPin(false);
      setPin('');
      setConfirm('');
      toast.success(done);
    } catch (cause) {
      setError(
        cause instanceof Error && /PIN|screen lock/.test(cause.message)
          ? cause.message
          : vaultError(cause, 'Couldn’t save this setting. Try again.'),
      );
    } finally {
      setBusy(false);
    }
  };
  const pinError =
    pin && !PIN_PATTERN.test(pin)
      ? 'Use 4 to 8 digits.'
      : confirm && confirm !== pin
        ? 'PINs don’t match.'
        : '';
  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Vault security" back backFallback={'/vault' as Href} />
      {!open ? (
        <Text color="secondary" center style={styles.locked}>
          Unlock your vault to change how it opens.
        </Text>
      ) : (
        <View style={styles.content}>
          <SettingsGroup title="Open vault with">
            <SettingsRow
              icon="finger-print"
              title="Biometrics"
              subtitle={
                noLock
                  ? 'Set up a phone screen lock first'
                  : 'Fingerprint or face, with your screen lock as backup'
              }
              value={method === 'device'}
              onValueChange={() => {
                if (method === 'device') return;
                void run(() => setUnlockMethod(owner, 'device'), 'Vault now opens with biometrics');
              }}
            />
            <SettingsRow
              icon="keypad-outline"
              title="Vault PIN"
              subtitle="A separate 4–8 digit PIN just for the vault"
              value={method === 'pin'}
              onValueChange={() => {
                if (method !== 'pin') setEditingPin(true);
              }}
              last
            />
          </SettingsGroup>
          {method === 'pin' && !editingPin && (
            <Button
              label="Change PIN"
              variant="secondary"
              icon="key-outline"
              onPress={() => setEditingPin(true)}
            />
          )}
          {editingPin && (
            <View style={styles.form}>
              <TextField
                label={method === 'pin' ? 'New PIN' : 'Choose a PIN'}
                value={pin}
                onChangeText={(value) => setPin(digits(value))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                autoComplete="off"
              />
              <TextField
                label="Confirm PIN"
                value={confirm}
                onChangeText={(value) => setConfirm(digits(value))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                autoComplete="off"
                error={pinError || undefined}
              />
              <Text variant="caption" color="secondary">
                If you forget this PIN, you’ll need to log out and sign in again; photos that are
                backed up will download again.
              </Text>
              <Button
                label="Save PIN"
                loading={busy}
                disabled={!PIN_PATTERN.test(pin) || confirm !== pin}
                onPress={() =>
                  void run(() => setUnlockMethod(owner, 'pin', pin), 'Vault PIN saved')
                }
              />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setEditingPin(false);
                  setPin('');
                  setConfirm('');
                }}
              />
            </View>
          )}
          {!!error && (
            <Text color="danger" accessibilityRole="alert">
              {error}
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingVertical: 16 },
  form: { gap: 12 },
  locked: { marginTop: 48 },
});
