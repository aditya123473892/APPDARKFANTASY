import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AuthPrompt, AuthScaffold } from '../components/AuthScaffold';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { RegisterForm } from '../components/RegisterForm';
import { phoneAuth } from '../services/phoneAuth';

/** Signup verifies the phone first, then collects the profile and creates the account. */
export function RegisterScreen(): React.JSX.Element {
  const router = useRouter();
  const [signupToken, setSignupToken] = useState<string | null>(null);
  return (
    <AuthScaffold
      title={signupToken ? 'A little about you' : 'Create your account'}
      subtitle={
        signupToken
          ? "Number verified. A few details and you're in."
          : "Start with your mobile number. You'll use it to sign in."
      }
      footer={
        <AuthPrompt
          question="Already have an account?"
          action="Sign in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      {signupToken ? (
        <RegisterForm signupToken={signupToken} onSignupExpired={() => setSignupToken(null)} />
      ) : (
        <PhoneOtpFlow
          sendCode={phoneAuth.sendSignupCode}
          verifyCode={async (phone, code) =>
            setSignupToken(await phoneAuth.verifySignupCode(phone, code))
          }
          sendLabel="Continue"
          verifyLabel="Verify number"
          autoFocus={false}
        />
      )}
    </AuthScaffold>
  );
}
