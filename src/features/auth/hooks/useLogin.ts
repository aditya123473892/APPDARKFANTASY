import { useCallback, useEffect, useState } from 'react';
import { authService } from '../services';
import { AuthError } from '../types';
import { useAuthStore } from '../store/authStore';

export function useLogin() {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (cooldown > 0) return false;
      setLoading(true);
      setError(null);
      try {
        const result = await authService.login({ email, password, strategy: 'email_password' });
        await setAuthenticated(result);
        setFailedAttempts(0);
        return true;
      } catch (caught) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 3 || (caught instanceof AuthError && caught.code === 'RATE_LIMITED')) {
          setCooldown(15);
          setFailedAttempts(0);
          setError('Too many attempts. Please wait before trying again.');
        } else setError('We couldn’t sign you in. Check your details and try again.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [cooldown, failedAttempts, setAuthenticated],
  );
  return { login, error, isLoading, cooldown };
}
