import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Input } from '@/components/ui';
import { AuthPrompt, AuthScaffold } from '../components/AuthScaffold';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { VerifiedPhoneRegisterForm } from '../components/VerifiedPhoneRegisterForm';
import { phoneAuth } from '../services/phoneAuth';
import { signupEmailSchema } from '../schemas/authSchemas';

/** Collect email and contact number together, verify the number, then create the account. */
export function PhoneRegisterScreen(): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [signup, setSignup] = useState<{ token: string; phone: string; email: string } | null>(
    null,
  );
  const validateEmail = () => {
    const result = signupEmailSchema.safeParse(email);
    setEmailError(result.success ? undefined : result.error.issues[0]?.message);
    if (result.success) setEmail(result.data);
    return result.success;
  };
  return (
    <AuthScaffold
      title={signup ? 'Secure your account' : 'Create your account'}
      subtitle={
        signup
          ? 'Your contact number is verified. Create a password to finish signing up.'
          : 'Sign up with your email and contact number. We’ll send an SMS to verify your number.'
      }
      footer={
        <AuthPrompt
          question="Already have an account?"
          action="Sign in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      {signup ? (
        <VerifiedPhoneRegisterForm
          signupToken={signup.token}
          email={signup.email}
          phone={signup.phone}
          onSignupExpired={() => setSignup(null)}
        />
      ) : (
        <PhoneOtpFlow
          sendCode={phoneAuth.sendSignupCode}
          verifyCode={async (phone, code) => {
            const token = await phoneAuth.verifySignupCode(phone, code);
            setSignup({ token, phone, email: signupEmailSchema.parse(email) });
          }}
          renderPhoneFields={(loading) => (
            <Input
              label="Email address"
              icon="mail-outline"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setEmailError(undefined);
              }}
              onBlur={() => {
                if (email.trim()) validateEmail();
              }}
              error={emailError}
            />
          )}
          validatePhoneEntry={validateEmail}
          phoneHint="This contact number will be linked to your account."
          sendLabel="Verify contact number"
          verifyLabel="Verify number"
          autoFocus={false}
        />
      )}
    </AuthScaffold>
  );
}
