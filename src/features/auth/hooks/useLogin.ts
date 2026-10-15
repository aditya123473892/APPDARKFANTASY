import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../services';
import { AuthError } from '../types';
import { getAuthRevision, useAuthStore } from '../store/authStore';

// Module lifetime keeps the UX delay when the login screen is remounted.
let failures = 0;
let blockedUntil = 0;
let submitting = false;
export function useLogin() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(
      () => setCooldown(Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))),
      250,
    );
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (submitting || Date.now() < blockedUntil) return false;
    submitting = true; // Synchronous, before any await or React update.
    setLoading(true);
    setError(null);
    const store = useAuthStore.getState();
    const attempt = store.beginLogin();
    try {
      const request = authService.login({ email, password, strategy: 'email_password' });
      password = '';
      const result = await request;
      if (attempt !== getAuthRevision()) return false;
      await store.setAuthenticated(result);
      failures = 0;
      blockedUntil = 0;
      return true;
    } catch (caught) {
      if (
        caught instanceof AuthError &&
        ['BLOCKED', 'UNVERIFIED'].includes(caught.code) &&
        attempt === getAuthRevision()
      ) {
        useAuthStore.setState({ status: caught.code === 'BLOCKED' ? 'blocked' : 'unverified' });
      }
      failures++;
      const seconds =
        caught instanceof AuthError && caught.code === 'RATE_LIMITED'
          ? 60
          : failures >= 3
            ? Math.min(300, 5 * 2 ** Math.min(failures - 3, 6))
            : 0;
      blockedUntil = Date.now() + seconds * 1000;
      if (mounted.current) {
        setCooldown(seconds);
        const code = caught instanceof AuthError ? caught.code : 'SERVER';
        setError(
          code === 'NETWORK'
            ? 'Unable to reach the server. Check your connection and try again.'
            : code === 'SESSION_EXPIRED'
              ? 'Your session expired. Please sign in again.'
              : code === 'SERVER'
                ? 'Sign-in is unavailable. Please try again later.'
                : 'Unable to sign in. Check your credentials or contact support.',
        );
      }
      return false;
    } finally {
      password = '';
      submitting = false;
      if (mounted.current) setLoading(false);
    }
  }, []);
  return { login, error, isLoading, cooldown };
}
