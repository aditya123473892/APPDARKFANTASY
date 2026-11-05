import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { BackHandler, Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import type { CountryCode } from 'libphonenumber-js';
import { Screen, useSafeBack } from '@/components/layout';
import { Button, IconButton, Input, PasswordInput, Text } from '@/components/ui';
import { Pressable } from '@/components/ui/Pressable';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { DEFAULT_COUNTRY, toE164 } from '../phone';
import { emailSignupSchema, type EmailSignupValues } from '../schemas/authSchemas';
import { useEmailRegister } from '../hooks/useEmailRegister';
import { AuthPrompt } from './AuthScaffold';
import { CountryPicker } from './CountryPicker';
import { CONSENT_REQUIRED, ConsentCheckbox } from '@/features/legal/ConsentCheckbox';

const PROFILE_FIELDS = ['name', 'lastName', 'age', 'gender'] as const;
const GENDERS = ['Woman', 'Man', 'Non-binary', 'Prefer not to say'];

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const leave = useSafeBack('/welcome');
  const { theme } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { register, error, isLoading, success, emailVerificationRequired } = useEmailRegister();
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string>();
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const {
    control,
    handleSubmit,
    resetField,
    setValue,
    trigger,
    setFocus,
    formState: { errors },
  } = useForm<EmailSignupValues>({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: {
      name: '',
      lastName: '',
      age: '',
      gender: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });
  const moveTo = (next: number) => {
    Keyboard.dismiss();
    setStep(next);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  };
  useEffect(() => {
    if (step !== 1 || success) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isLoading) moveTo(0);
      return true;
    });
    return () => sub.remove();
  }, [step, isLoading, success]);
  const next = async () => {
    if (await trigger([...PROFILE_FIELDS], { shouldFocus: true })) moveTo(1);
  };
  const submit = () =>
    handleSubmit(
      async (values) => {
        if (!consent) {
          setConsentError(CONSENT_REQUIRED);
          return;
        }
        const completed = await register({ ...values });
        if (completed) {
          Keyboard.dismiss();
          resetField('password');
          resetField('confirmPassword');
          scroll.current?.scrollTo({ y: 0, animated: false });
        }
      },
      (invalid) => {
        if (PROFILE_FIELDS.some((field) => invalid[field])) moveTo(0);
      },
    )();
  const nameField = (name: 'name' | 'lastName') => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          ref={field.ref}
          label={name === 'name' ? 'First name' : 'Last name'}
          placeholder={name === 'name' ? 'First name' : 'Last name'}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete={name === 'name' ? 'given-name' : 'family-name'}
          maxLength={50}
          value={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => setFocus(name === 'name' ? 'lastName' : 'age')}
        />
      )}
    />
  );
  return (
    <Screen padded={false}>
      <KeyboardAwareScrollView
        ref={scroll}
        bottomOffset={spacing.xl}
        disableScrollOnKeyboardHide
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.content}>
          <View style={styles.topbar}>
            <IconButton
              icon="arrow-back"
              label={step === 1 && !success ? 'Back to your details' : 'Go back'}
              disabled={isLoading}
              onPress={() => (step === 1 && !success ? moveTo(0) : leave())}
            />
            <Text variant="caption" weight="semibold" style={styles.brand}>
              DARKFANTASY
            </Text>
            <View style={styles.balance} />
          </View>
          {success ? (
            <View style={styles.success}>
              <View style={[styles.successIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons
                  name={emailVerificationRequired ? 'mail-outline' : 'checkmark'}
                  size={32}
                  color={theme.colors.primaryText}
                />
              </View>
              <Text serif style={styles.heading} center accessibilityRole="header">
                {emailVerificationRequired ? 'Check your inbox.' : 'You’re all set.'}
              </Text>
              <Text color="secondary" center>
                {emailVerificationRequired
                  ? 'Open the verification link in your email, then come back to sign in.'
                  : 'Your account is ready. Sign in with your email and password.'}
              </Text>
              <Button label="Go to sign in" onPress={() => router.replace('/login')} />
            </View>
          ) : (
            <>
              <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of 2`}>
                {['About you', 'Account details'].map((label, index) => (
                  <View key={label} style={styles.progressItem}>
                    <View
                      style={[
                        styles.progressLine,
                        {
                          backgroundColor:
                            index <= step ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    />
                    <Text variant="caption" color={index === step ? 'primary' : 'muted'}>
                      {index + 1}. {label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.intro}>
                <Text serif accessibilityRole="header" style={styles.heading}>
                  {step === 0 ? 'A little about you.' : 'Create your account.'}
                </Text>
                <Text color="secondary">
                  {step === 0
                    ? 'Let’s start with the basics.'
                    : 'Sign up with your email and password.'}
                </Text>
              </View>
              <View style={styles.fields}>
                {step === 0 ? (
                  <>
                    <View
                      style={[styles.nameRow, (width < 360 || fontScale > 1.2) && styles.stacked]}
                    >
                      <View style={styles.nameField}>{nameField('name')}</View>
                      <View style={styles.nameField}>{nameField('lastName')}</View>
                    </View>
                    <Controller
                      control={control}
                      name="age"
                      render={({ field }) => (
                        <Input
                          ref={field.ref}
                          label="Age"
                          placeholder="Your age"
                          keyboardType="number-pad"
                          maxLength={3}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.age?.message}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <View style={styles.genderGroup}>
                          <Text variant="label" color="secondary">
                            Gender
                          </Text>
                          <View style={styles.genderOptions}>
                            {GENDERS.map((value) => (
                              <Pressable
                                key={value}
                                accessibilityRole="radio"
                                accessibilityLabel={value}
                                accessibilityState={{ checked: field.value === value }}
                                onPress={() => {
                                  field.onChange(value);
                                  field.onBlur();
                                }}
                                style={[
                                  styles.genderOption,
                                  {
                                    borderColor:
                                      field.value === value
                                        ? theme.colors.primary
                                        : theme.colors.border,
                                    backgroundColor:
                                      field.value === value
                                        ? theme.colors.primarySoft
                                        : theme.colors.surface,
                                  },
                                ]}
                              >
                                <Text
                                  variant="label"
                                  color={field.value === value ? 'primary' : 'secondary'}
                                  center
                                >
                                  {value}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          {errors.gender ? (
                            <Text variant="caption" color="danger">
                              {errors.gender.message}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    />
                    <Button
                      label="Continue"
                      icon="arrow-forward"
                      onPress={() => void next()}
                      style={styles.cta}
                    />
                  </>
                ) : (
                  <>
                    <Controller
                      control={control}
                      name="email"
                      render={({ field }) => (
                        <Input
                          ref={field.ref}
                          label="Email address"
                          placeholder="you@example.com"
                          icon="mail-outline"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="email"
                          textContentType="emailAddress"
                          maxLength={254}
                          editable={!isLoading}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.email?.message}
                          returnKeyType="next"
                          submitBehavior="submit"
                          onSubmitEditing={() => setFocus('phoneNumber')}
                        />
                      )}
                    />
                    <View style={styles.contact}>
                      <Text variant="label" color="secondary" nativeID="contact-label">
                        Contact number
                      </Text>
                      <View style={styles.phoneRow}>
                        <CountryPicker
                          value={country}
                          disabled={isLoading}
                          onChange={(value) => {
                            setCountry(value);
                            setValue('phoneNumber', toE164(national, value) ?? '', {
                              shouldValidate: Boolean(national),
                            });
                          }}
                        />
                        <Controller
                          control={control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <View style={styles.phoneInput}>
                              <Input
                                ref={field.ref}
                                accessibilityLabel="Contact number"
                                accessibilityLabelledBy="contact-label"
                                keyboardType="phone-pad"
                                autoComplete="tel-national"
                                textContentType="telephoneNumber"
                                placeholder="Mobile number"
                                maxLength={20}
                                editable={!isLoading}
                                value={national}
                                onChangeText={(value) => {
                                  setNational(value);
                                  field.onChange(toE164(value, country) ?? '');
                                }}
                                onBlur={field.onBlur}
                              />
                            </View>
                          )}
                        />
                      </View>
                      {errors.phoneNumber ? (
                        <Text variant="caption" color="danger">
                          {errors.phoneNumber.message}
                        </Text>
                      ) : null}
                    </View>
                    <Controller
                      control={control}
                      name="password"
                      render={({ field }) => (
                        <PasswordInput
                          ref={field.ref}
                          label="Password"
                          accessibilityLabel="Password"
                          placeholder="Create password"
                          autoComplete="new-password"
                          textContentType="newPassword"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.password?.message}
                          editable={!isLoading}
                          returnKeyType="next"
                          submitBehavior="submit"
                          onSubmitEditing={() => setFocus('confirmPassword')}
                        />
                      )}
                    />
                    <Text variant="caption" color="muted" style={styles.passwordHint}>
                      8+ characters, one uppercase letter and one number.
                    </Text>
                    <Controller
                      control={control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <PasswordInput
                          ref={field.ref}
                          label="Confirm password"
                          accessibilityLabel="Confirm password"
                          placeholder="Confirm password"
                          autoComplete="new-password"
                          textContentType="newPassword"
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          error={errors.confirmPassword?.message}
                          editable={!isLoading}
                          returnKeyType="done"
                          submitBehavior="submit"
                          onSubmitEditing={() => void submit()}
                        />
                      )}
                    />
                    <ConsentCheckbox
                      checked={consent}
                      disabled={isLoading}
                      error={consentError}
                      onChange={(value) => {
                        setConsent(value);
                        if (value) setConsentError(undefined);
                      }}
                    />
                    {error ? (
                      <View style={[styles.alert, { backgroundColor: theme.colors.dangerSoft }]}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={20}
                          color={theme.colors.danger}
                        />
                        <Text color="danger" accessibilityRole="alert" style={styles.alertText}>
                          {error}
                        </Text>
                      </View>
                    ) : null}
                    <Button
                      label="Create account"
                      loading={isLoading}
                      onPress={() => void submit()}
                      style={styles.cta}
                    />
                  </>
                )}
              </View>
            </>
          )}
        </View>
        {!success ? (
          <View style={styles.footer}>
            <AuthPrompt
              question="Already a member?"
              action="Sign in"
              onPress={() => router.replace('/login')}
            />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  content: { flexGrow: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    marginBottom: spacing.lg,
  },
  brand: { letterSpacing: 2, fontSize: 11 },
  balance: { width: spacing.touch },
  progress: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  progressItem: { flex: 1, gap: spacing.sm },
  progressLine: { height: 3, borderRadius: radius.full },
  intro: { gap: spacing.sm, marginBottom: spacing.xl },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  fields: { gap: spacing.md },
  nameRow: { flexDirection: 'row', gap: spacing.md },
  stacked: { flexDirection: 'column' },
  nameField: { flex: 1, minWidth: 0 },
  genderGroup: { gap: spacing.sm, marginTop: spacing.xs },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  genderOption: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: spacing.touch,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  contact: { gap: spacing.sm },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phoneInput: { flex: 1, minWidth: 0 },
  passwordHint: { marginTop: -spacing.xs },
  cta: { marginTop: spacing.md, minHeight: 52 },
  footer: { paddingTop: spacing.xl, paddingBottom: spacing.sm },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  alertText: { flex: 1, fontSize: 14 },
  success: { paddingTop: spacing.huge, gap: spacing.xl },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
