import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Text, TextField } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { SettingsGroup, SettingsRow } from '@/features/settings/components/SettingsRow';
import { useAuthStore } from '@/features/auth/store/authStore';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { spacing } from '@/theme';
import { APP_PIN } from './credentials';
import { biometricAvailability, changeLockSettings, LOCK_TIMEOUTS, setAppPin } from './service';
import { useAppLock } from './state';

type Change = { biometric?: boolean; timeout?: number; disable?: boolean };
const timeoutLabel = (value: number) =>
  value === 0
    ? 'Immediately'
    : value === 30_000
      ? 'After 30 seconds'
      : value === 60_000
        ? 'After 1 minute'
        : 'After 5 minutes';
const digits = (value: string) => value.replace(/\D/g, '').slice(0, 12);

export function AppLockSettingsScreen() {
  const owner = useAuthStore((s) => s.session?.userId);
  const config = useAppLock((s) => s.config);
  const [previous, setPrevious] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [available, setAvailable] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [showTimeouts, setShowTimeouts] = useState(false);
  const [pending, setPending] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const working = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    const refresh = () =>
      void biometricAvailability()
        .then((value) => {
          if (alive) setAvailable(value);
        })
        .catch(() => {
          if (alive) setAvailable(false);
        });
    refresh();
    const listener = AppState.addEventListener('change', (value) => {
      if (value === 'active') refresh();
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  const cancel = () => {
    setPending(null);
    setEditingPin(false);
    setPrevious('');
    setPin('');
    setConfirm('');
    setError('');
  };
  const run = async (
    work: () => ReturnType<typeof setAppPin> | ReturnType<typeof changeLockSettings>,
    done: string,
  ) => {
    if (working.current || !owner) return;
    working.current = true;
    setBusy(true);
    setError('');
    const generation = sessionIdentity.generation;
    try {
      const next = await work();
      if (
        generation !== sessionIdentity.generation ||
        useAuthStore.getState().session?.userId !== owner
      )
        return;
      useAppLock.setState((current) => ({ config: next, locked: next ? current.locked : false }));
      cancel();
      toast.success(done);
    } catch (cause) {
      if (generation === sessionIdentity.generation)
        setError(cause instanceof Error ? cause.message : 'Could not update App Lock. Try again.');
      setPrevious('');
    } finally {
      setBusy(false);
      working.current = false;
    }
  };
  const requestChange = (change: Change) => {
    if (busy) return;
    cancel();
    setShowTimeouts(false);
    setPending(change);
    if (config?.biometric && !change.disable)
      void run(() => changeLockSettings(owner!, null, change), 'App Lock updated');
  };
  const pinFields = (
    <>
      <TextField
        label={config ? 'New app PIN' : 'Choose a backup PIN'}
        value={pin}
        onChangeText={(value) => setPin(digits(value))}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={12}
        autoComplete="off"
      />
      <TextField
        label="Confirm PIN"
        value={confirm}
        onChangeText={(value) => setConfirm(digits(value))}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={12}
        autoComplete="off"
        error={confirm && pin !== confirm ? 'PINs do not match.' : undefined}
      />
      <Text variant="caption" color="secondary">
        Use 4–12 digits. This PIN works if fingerprint or Face ID is unavailable.
      </Text>
    </>
  );
  return (
    <Screen scroll>
      <Header title="App Lock" back />
      <View style={{ paddingVertical: spacing.lg, gap: spacing.lg }}>
        {Platform.OS === 'web' ? (
          <Text>App Lock is available in the Android and iOS app.</Text>
        ) : !owner ? (
          <Text>Sign in to configure App Lock.</Text>
        ) : (
          <>
            <Text variant="title">
              {config ? 'Your app is protected' : 'Keep your app private'}
            </Text>
            <Text color="secondary">
              {config
                ? `${config.biometric ? 'Fingerprint or Face ID, with a backup PIN.' : 'Protected with your app PIN.'} Your Photo Vault has its own lock.`
                : 'Set a backup PIN and choose fingerprint or Face ID. Everything is saved in one step.'}
            </Text>
            {!config ? (
              <View style={{ gap: spacing.md }}>
                {pinFields}
                <SettingsGroup>
                  <SettingsRow
                    icon="finger-print"
                    title="Use fingerprint or Face ID"
                    value={available && useBiometrics}
                    subtitle={
                      available
                        ? 'Recommended for quick unlock'
                        : 'Set up biometrics in your phone settings to use this'
                    }
                    loading={busy}
                    onValueChange={(value) => {
                      if (available) setUseBiometrics(value);
                    }}
                    last
                  />
                </SettingsGroup>
                <Button
                  label={available && useBiometrics ? 'Enable with biometrics' : 'Enable with PIN'}
                  loading={busy}
                  disabled={busy || !APP_PIN.test(pin) || pin !== confirm}
                  onPress={() =>
                    void run(
                      () => setAppPin(owner, pin, undefined, available && useBiometrics),
                      'App Lock enabled',
                    )
                  }
                />
                {!!error && available && useBiometrics && (
                  <Button
                    label="Use PIN only"
                    variant="ghost"
                    disabled={busy}
                    onPress={() => {
                      setUseBiometrics(false);
                      setError('');
                    }}
                  />
                )}
              </View>
            ) : editingPin || pending ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="label">
                  {editingPin
                    ? 'Change your PIN'
                    : pending?.disable
                      ? 'Turn off App Lock?'
                      : 'Confirm this change'}
                </Text>
                <Text variant="caption" color="secondary">
                  {pending?.disable
                    ? 'Your app will open without asking you to unlock it.'
                    : 'Verify with your current app PIN or biometrics.'}
                </Text>
                <TextField
                  label="Current app PIN"
                  value={previous}
                  onChangeText={(value) => setPrevious(digits(value))}
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={12}
                  autoComplete="off"
                />
                {editingPin && pinFields}
                <Button
                  label={
                    editingPin
                      ? 'Save new PIN'
                      : pending?.disable
                        ? 'Turn off App Lock'
                        : 'Save change'
                  }
                  loading={busy}
                  disabled={
                    busy ||
                    !APP_PIN.test(previous) ||
                    (editingPin && (!APP_PIN.test(pin) || pin !== confirm))
                  }
                  onPress={() =>
                    void run(
                      () =>
                        editingPin
                          ? setAppPin(owner, pin, previous)
                          : changeLockSettings(owner, previous, pending!),
                      pending?.disable ? 'App Lock turned off' : 'App Lock updated',
                    )
                  }
                />
                {config.biometric && (
                  <Button
                    label="Confirm with biometrics"
                    variant="secondary"
                    disabled={busy || (editingPin && (!APP_PIN.test(pin) || pin !== confirm))}
                    onPress={() =>
                      void run(
                        () =>
                          editingPin
                            ? setAppPin(owner, pin, null)
                            : changeLockSettings(owner, null, pending!),
                        pending?.disable ? 'App Lock turned off' : 'App Lock updated',
                      )
                    }
                  />
                )}
                <Button label="Cancel" variant="ghost" disabled={busy} onPress={cancel} />
              </View>
            ) : (
              <>
                <SettingsGroup title="Unlock">
                  <SettingsRow
                    icon="finger-print"
                    title="Fingerprint or Face ID"
                    value={config.biometric}
                    loading={busy}
                    subtitle={
                      config.biometric
                        ? 'Quick unlock is on'
                        : available
                          ? 'Turn on quick unlock'
                          : 'Set up biometrics in phone settings first'
                    }
                    onValueChange={(value) => {
                      if (!value || available) requestChange({ biometric: value });
                    }}
                  />
                  <SettingsRow
                    icon="keypad-outline"
                    title="Change backup PIN"
                    onPress={() => {
                      cancel();
                      setEditingPin(true);
                    }}
                    last
                  />
                </SettingsGroup>
                <SettingsGroup title="When you leave the app">
                  <SettingsRow
                    icon="time-outline"
                    title="Lock app"
                    subtitle={timeoutLabel(config.timeout)}
                    onPress={() => setShowTimeouts((value) => !value)}
                    last
                  />
                  {showTimeouts &&
                    LOCK_TIMEOUTS.map((timeout) => (
                      <SettingsRow
                        key={timeout}
                        icon={config.timeout === timeout ? 'checkmark-circle' : 'ellipse-outline'}
                        title={timeoutLabel(timeout)}
                        onPress={() => {
                          if (timeout !== config.timeout) requestChange({ timeout });
                          else setShowTimeouts(false);
                        }}
                        last={timeout === 300_000}
                      />
                    ))}
                </SettingsGroup>
                <Button
                  label="Turn off App Lock"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => requestChange({ disable: true })}
                />
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" color="danger">
                {error}
              </Text>
            )}
            <Text variant="caption" color="secondary">
              Forgot your PIN? Use “Forgot PIN?” on the lock screen to verify your account password.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}
