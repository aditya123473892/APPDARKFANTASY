import { useRef, useState } from 'react';
import { authService } from '../services';
import { phoneErrorMessage } from '../services/phoneAuth';
import type { RegisterInput } from '../types';

/** Saves contact details without claiming that the number has been verified. */
export function useEmailRegister() {
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const register = async (input: RegisterInput) => {
    if (busy.current) return false;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await authService.register(input);
      setEmailVerificationRequired(result.emailVerificationRequired);
      setSuccess(true);
      return true;
    } catch (caught) {
      setError(phoneErrorMessage(caught));
      return false;
    } finally {
      input.password = '';
      busy.current = false;
      setLoading(false);
    }
  };
  return { register, error, isLoading, success, emailVerificationRequired };
}
