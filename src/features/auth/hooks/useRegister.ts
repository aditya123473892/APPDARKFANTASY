import { useRef, useState } from 'react';
import { phoneAuth, phoneErrorMessage } from '../services/phoneAuth';
import { completePhoneSignIn } from '../phoneSignIn';
import { AuthError, type RegisterInput } from '../types';

/** Creates the account for a phone already verified with signupToken. */
export function useRegister(signupToken: string, onSignupExpired?: () => void) {
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const register = async (input: Pick<RegisterInput, 'email' | 'password'>): Promise<boolean> => {
    if (submitting.current) return false;
    submitting.current = true;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await phoneAuth.completeSignup(input, signupToken);
      // Signed in straight away unless the email must be verified first.
      if (result) await completePhoneSignIn(async () => result);
      else setSuccess(true);
      return true;
    } catch (caught) {
      const code = caught instanceof AuthError ? caught.code : 'SERVER';
      if (code === 'SIGNUP_SESSION_INVALID' || code === 'PHONE_IN_USE') onSignupExpired?.();
      setError(
        ['SERVER', 'UNKNOWN'].includes(code)
          ? 'We could not create your account. Please try again.'
          : phoneErrorMessage(caught),
      );
      return false;
    } finally {
      input.password = '';
      submitting.current = false;
      setLoading(false);
    }
  };
  return { register, error, isLoading, success };
}
