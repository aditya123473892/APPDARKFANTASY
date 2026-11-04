import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Keyboard, Platform, View } from 'react-native';
import { Button, Text, TextField } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { sessionIdentity } from '@/features/auth/sessionRuntime';
import { realAuthService } from '@/features/auth/services/authService.real';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { lockExpired } from './credentials';
import { biometricUnlock, readAppLock, verifyAppPin } from './service';
import { useAppLock } from './state';
import { EXTERNAL_GRACE_MS, inExternalActivity } from '@/services/externalActivity';

const cover = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * Protected navigation never mounts for an account until secure storage has been read and
 * the lock is satisfied. After that first unlock, relocking covers the app instead of
 * unmounting it, so unsent text, scroll positions and open screens survive.
 */
export function AppLockBoundary({ children }: PropsWithChildren) {
  const owner = useAuthStore((s) => s.session?.userId ?? null);
  const email = useAuthStore((s) => s.currentUser?.username ?? '');
  const { theme } = useTheme();
  const state = useAppLock();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [recover, setRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompt = useRef(false);
  const background = useRef<number | null>(null);
  // Left for a picker, camera or share sheet the app opened itself.
  const external = useRef(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  /** The account whose protected screens have been unlocked (and mounted) once. */
  const [mountedFor, setMountedFor] = useState<string | null>(null);
  /** Shows the reading message only when secure storage is slow, not on every sign-in. */
  const [slowFor, setSlowFor] = useState<string | null>(null);
  useEffect(() => {
    if (owner && state.owner === owner && state.ready && state.locked)
      void SplashScreen.hideAsync().catch(() => undefined);
  }, [owner, state.owner, state.ready, state.locked]);
  useEffect(() => {
    let valid = true;
    // Reset account-specific entry fields at the async storage boundary.
    useAppLock.setState({ owner, ready: !owner, locked: true, config: null, error: '' });
    if (owner && Platform.OS !== 'web')
      void readAppLock(owner)
        .then((config) => {
          if (valid) {
            setPin('');
            setPassword('');
            setRecover(false);
          }
          if (valid) useAppLock.setState({ ready: true, config, locked: !!config });
        })
        .catch(() => {
          if (valid)
            useAppLock.setState({
              ready: true,
              locked: true,
              error: 'Could not read App Lock. Retry or verify your account password.',
            });
        });
    else if (Platform.OS === 'web') useAppLock.setState({ ready: true, locked: false });
    return () => {
      valid = false;
    };
  }, [owner]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
      const current = useAppLock.getState();
      if (next !== 'active') {
        // Only real backgrounding starts the timer. iOS reports "inactive" for Control
        // Center, notifications and Face ID, which made "Immediately" relock after them.
        if (next === 'background' && !prompt.current && background.current === null) {
          background.current = Date.now();
          external.current = inExternalActivity();
        }
        setPin('');
        setPassword('');
      } else {
        const timeout =
          current.config && external.current
            ? Math.max(current.config.timeout, EXTERNAL_GRACE_MS)
            : (current.config?.timeout ?? 0);
        if (current.config && lockExpired(background.current, timeout)) {
          Keyboard.dismiss();
          useAppLock.setState({ locked: true });
        }
        background.current = null;
        external.current = false;
      }
    });
    return () => listener.remove();
  }, []);
  const unlock = async (biometric = false) => {
    if (!owner || busy || prompt.current) return;
    prompt.current = true;
    setBusy(true);
    useAppLock.setState({ error: '' });
    const value = pin;
    setPin('');
    const generation = sessionIdentity.generation;
    try {
      const config = biometric ? await biometricUnlock(owner) : await verifyAppPin(owner, value);
      if (
        generation === sessionIdentity.generation &&
        owner === useAuthStore.getState().session?.userId &&
        AppState.currentState === 'active'
      )
        useAppLock.setState({ config, locked: false, ready: true });
    } catch (cause) {
      useAppLock.setState({
        error: cause instanceof Error ? cause.message : 'Could not unlock. Try your PIN.',
      });
    } finally {
      prompt.current = false;
      setBusy(false);
    }
  };
  const recovery = async () => {
    if (!owner || !email || busy) return;
    setBusy(true);
    const value = password;
    setPassword('');
    const generation = sessionIdentity.generation;
    try {
      const result = await realAuthService.login({
        email,
        password: value,
        strategy: 'email_password',
      });
      if (
        generation !== sessionIdentity.generation ||
        result.user._id !== owner ||
        useAuthStore.getState().session?.userId !== owner
      )
        throw new Error('Verify the same account.');
      await SecureStore.deleteItemAsync('darkfantasy.app-lock.' + owner);
      await SecureStore.deleteItemAsync('darkfantasy.app-lock.' + owner + '.biometric');
      useAppLock.setState({ config: null, locked: false, ready: true, error: '' });
      setRecover(false);
    } catch {
      useAppLock.setState({
        error: 'Could not verify your account. Check your password and connection.',
      });
    } finally {
      setBusy(false);
    }
  };
  // Offer fingerprint/face straight away each time the lock screen appears, so unlocking
  // takes one touch. Cancelling leaves the PIN field and the biometrics button.
  const offered = useRef(false);
  // `unlock` is rebuilt every render; the effect below calls the latest one.
  const latestUnlock = useRef(unlock);
  useEffect(() => {
    latestUnlock.current = unlock;
  });
  const biometricScreen =
    Boolean(owner) &&
    state.owner === owner &&
    state.ready &&
    state.locked &&
    active &&
    !recover &&
    Boolean(state.config?.biometric);
  useEffect(() => {
    if (!state.locked) offered.current = false;
    if (!biometricScreen || offered.current) return;
    offered.current = true;
    void latestUnlock.current(true);
  }, [biometricScreen, state.locked]);
  const ready = Boolean(owner) && state.owner === owner && state.ready;
  const open = ready && !state.locked;
  // Derived during render (React's sanctioned pattern), so the first unlock mounts at once.
  if (open && owner && mountedFor !== owner) setMountedFor(owner);
  useEffect(() => {
    if (ready || !owner) return;
    const timer = setTimeout(() => setSlowFor(owner), 800);
    return () => clearTimeout(timer);
  }, [ready, owner]);
  const slowRead = !ready && slowFor === owner;
  if (!owner) return <>{children}</>;
  // Never while the lock state belongs to another account (it resets after a switch).
  const mounted = state.owner === owner && (mountedFor === owner || open);
  if (!mounted && !ready)
    // Reading secure storage: a plain screen, not an "App Lock" heading on every sign-in.
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background }}>
        {slowRead && active ? <Text center>Reading App Lock…</Text> : null}
      </View>
    );
  const covered = !open || !active;
  const lockScreen = (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text variant="heading" center>
        App Lock
      </Text>
      {!active ? null : !ready ? (
        <Text center>Reading App Lock…</Text>
      ) : (
        <>
          <Text center color="secondary">
            {recover
              ? 'Verify your account password to reset App Lock. Your vault PIN stays separate.'
              : state.config?.biometric
                ? 'Use your fingerprint or enter your app PIN.'
                : 'Enter your app PIN to continue.'}
          </Text>
          {recover ? (
            <TextField
              label="Account password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="off"
            />
          ) : (
            <TextField
              label="App PIN"
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={12}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (pin) void unlock();
              }}
            />
          )}
          {state.error ? (
            <Text accessibilityRole="alert" color="danger">
              {state.error}
            </Text>
          ) : null}
          <Button
            label={recover ? 'Verify and reset App Lock' : 'Unlock'}
            loading={busy}
            disabled={busy || (recover ? !password : !pin)}
            onPress={() => void (recover ? recovery() : unlock())}
          />
          {!recover && state.config?.biometric ? (
            <Button
              label="Unlock with Biometrics"
              variant="secondary"
              disabled={busy}
              onPress={() => void unlock(true)}
            />
          ) : null}
          <Button
            label={recover ? 'Use PIN' : 'Forgot PIN? Verify account password'}
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setRecover(!recover);
              setPin('');
              setPassword('');
            }}
          />
          {state.error && !state.config ? (
            <Button
              label="Retry reading App Lock"
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void readAppLock(owner)
                  .then((config) =>
                    useAppLock.setState({ config, locked: !!config, ready: true, error: '' }),
                  )
                  .catch(() =>
                    useAppLock.setState({
                      error: 'App Lock is unavailable. Verify your account password to reset.',
                    }),
                  )
                  .finally(() => setBusy(false));
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
  if (!mounted) return lockScreen;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {open && !active ? (
        <View style={{ ...cover, backgroundColor: theme.colors.background }} />
      ) : null}
      {!open ? <View style={cover}>{lockScreen}</View> : null}
    </View>
  );
}
