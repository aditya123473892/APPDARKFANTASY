import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CountryCode } from 'libphonenumber-js';
import { Button, Input, OTPInput, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { AuthError } from '../types';
import { DEFAULT_COUNTRY, formatPhone, toE164 } from '../phone';
import { phoneErrorMessage } from '../services/phoneAuth';
import { CountryPicker } from './CountryPicker';

const CODE_LENGTH = 6;
// Errors that mean the current code is unusable: clear it and point to "Resend".
const NEEDS_NEW_CODE = ['OTP_EXPIRED', 'OTP_CHECK_LIMIT'];

/**
 * Phone entry -> SMS code entry with resend timer. Used for sign-in, signup,
 * first-time phone setup and changing the number in settings.
 */
export function PhoneOtpFlow({
  sendCode,
  verifyCode,
  sendLabel = 'Send code',
  verifyLabel = 'Verify',
  phoneHint,
}: {
  /** Resolves with the server's resend cooldown in seconds. */
  sendCode: (phone: string) => Promise<number>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  sendLabel?: string;
  verifyLabel?: string;
  phoneHint?: string;
}): React.JSX.Element {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  // Both are set together when a code is sent; 0 means "no timer".
  const [now, setNow] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (step !== 'code' || remaining === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, remaining]);

  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      if (!mounted.current) return;
      setError(phoneErrorMessage(caught));
      if (
        caught instanceof AuthError &&
        (caught.code === 'OTP_INVALID' || NEEDS_NEW_CODE.includes(caught.code))
      )
        setCode('');
      if (caught instanceof AuthError && NEEDS_NEW_CODE.includes(caught.code)) setResendAt(0);
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const send = (target = phone) =>
    run(async () => {
      const seconds = await sendCode(target);
      if (!mounted.current) return;
      setPhone(target);
      setCode('');
      setStep('code');
      setNow(Date.now());
      setResendAt(Date.now() + Math.max(1, seconds) * 1000);
    });

  const submitPhone = () => {
    const e164 = toE164(national, country);
    if (!e164) {
      setError('Enter a valid mobile number for the selected country.');
      return;
    }
    void send(e164);
  };

  const verify = (value = code) => {
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    void run(() => verifyCode(phone, value));
  };

  if (step === 'phone')
    return (
      <View style={styles.form}>
        <Text variant="label" color="secondary">
          Mobile number
        </Text>
        <View style={styles.phoneRow}>
          <CountryPicker value={country} onChange={setCountry} disabled={loading} />
          <View style={styles.phoneInput}>
            <Input
              accessibilityLabel="Mobile number"
              placeholder="98765 43210"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel-national"
              returnKeyType="send"
              maxLength={20}
              value={national}
              onChangeText={setNational}
              onSubmitEditing={submitPhone}
              editable={!loading}
              autoFocus
            />
          </View>
        </View>
        {phoneHint ? (
          <Text variant="caption" color="muted">
            {phoneHint}
          </Text>
        ) : null}
        {error ? (
          <Text
            color="danger"
            variant="label"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        ) : null}
        <Button label={sendLabel} loading={loading} onPress={submitPhone} />
      </View>
    );

  return (
    <View style={styles.form}>
      <Text color="muted" center>
        Enter the {CODE_LENGTH}-digit code sent to{' '}
        <Text weight="semibold">{formatPhone(phone)}</Text>
      </Text>
      <OTPInput
        value={code}
        length={CODE_LENGTH}
        onChangeText={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        onComplete={verify}
        error={Boolean(error)}
        editable={!loading}
        autoFocus
      />
      {error ? (
        <Text
          color="danger"
          variant="label"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
      <Button label={verifyLabel} loading={loading} onPress={() => verify()} />
      <Button
        label={remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}
        variant="ghost"
        disabled={remaining > 0 || loading}
        accessibilityLabel={
          remaining > 0 ? `Resend available in ${remaining} seconds` : 'Resend code'
        }
        onPress={() => void send()}
      />
      <Button
        label="Change number"
        variant="ghost"
        disabled={loading}
        onPress={() => {
          setStep('phone');
          setCode('');
          setError(null);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  phoneRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  phoneInput: { flex: 1 },
});
