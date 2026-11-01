import { useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Text, TextField } from '@/components/ui';
import { SettingsGroup, SettingsRow } from '@/features/settings/components/SettingsRow';
import { useAuthStore } from '@/features/auth/store/authStore';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { spacing } from '@/theme';
import { APP_PIN } from './credentials';
import { changeLockSettings, LOCK_TIMEOUTS, setAppPin } from './service';
import { useAppLock } from './state';

export function AppLockSettingsScreen() {
  const owner = useAuthStore(s => s.session?.userId);
  const config = useAppLock(s => s.config);
  const [previous, setPrevious] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const working = useRef(false);
  const run = async (fn: () => ReturnType<typeof setAppPin> | ReturnType<typeof changeLockSettings>) => {
    if (working.current || !owner) return;
    if (config && !APP_PIN.test(previous)) { setError('Enter your current app PIN before changing App Lock.'); return; }
    working.current = true; setBusy(true); setError('');
    const generation = sessionIdentity.generation;
    try {
      const next = await fn();
      if (generation === sessionIdentity.generation && useAuthStore.getState().session?.userId === owner)
        useAppLock.setState(current => ({ config: next, locked: next ? current.locked : false }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update App Lock.'); }
    finally { setPrevious(''); setPin(''); setConfirm(''); setBusy(false); working.current = false; }
  };
  return <Screen padded={false}><Header title="App Lock" back /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
    {Platform.OS === 'web' ? <Text>App Lock is available in the Android and iOS app.</Text> : owner ? <>
      <Text>Use an app PIN of 6 to 12 digits. Biometrics are optional. Reset a forgotten PIN using your account password.</Text>
      {config ? <TextField label="Current app PIN" value={previous} onChangeText={setPrevious} secureTextEntry keyboardType="number-pad" maxLength={12} autoComplete="off" /> : null}
      <TextField label="New app PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={12} autoComplete="off" />
      <TextField label="Confirm new app PIN" value={confirm} onChangeText={setConfirm} secureTextEntry keyboardType="number-pad" maxLength={12} autoComplete="off" />
      <Button label={config ? 'Change PIN' : 'Enable App Lock'} loading={busy} disabled={busy || !APP_PIN.test(pin) || confirm !== pin || (!!config && !previous)} onPress={() => void run(() => setAppPin(owner, pin, previous))} />
      {config ? <>
        <SettingsGroup title="Unlock options"><SettingsRow icon="finger-print" title="Unlock with Biometrics" value={config.biometric} loading={busy} onValueChange={value => void run(() => changeLockSettings(owner, previous, { biometric: value }))} /></SettingsGroup>
        <SettingsGroup title="Auto-lock after backgrounding">{LOCK_TIMEOUTS.map(timeout => <SettingsRow key={timeout} icon={config.timeout === timeout ? 'checkmark-circle' : 'time-outline'} title={timeout === 0 ? 'Immediately' : timeout === 30000 ? '30 seconds' : timeout === 60000 ? '1 minute' : '5 minutes'} loading={busy} onPress={() => void run(() => changeLockSettings(owner, previous, { timeout }))} />)}</SettingsGroup>
        <Text variant="caption">Enter your current app PIN above to change unlock options or disable App Lock.</Text>
        <Button label="Disable App Lock" variant="secondary" disabled={busy} onPress={() => void run(() => changeLockSettings(owner, previous, { disable: true }))} />
      </> : null}
      {error ? <Text accessibilityRole="alert" color="danger">{error}</Text> : null}
    </> : <View><Text>Sign in to configure App Lock.</Text></View>}
  </ScrollView></Screen>;
}
