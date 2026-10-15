import { useRef, useState } from 'react';
import { authService } from '../services';
import { AuthError, type RegisterInput } from '../types';
export function useRegister() {
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const register = async (input: RegisterInput): Promise<boolean> => {
    if (submitting.current) return false;
    submitting.current = true;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await authService.register(input);
      setSuccess(true);
      return true;
    } catch (caught) {
      const code = caught instanceof AuthError ? caught.code : 'SERVER';
      setError(
        code === 'NETWORK'
          ? 'Unable to reach the server. Check your connection and try again.'
          : code === 'EMAIL_IN_USE'
            ? 'An account with this email already exists. Please sign in.'
            : 'We could not create your account. Please try again.',
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
