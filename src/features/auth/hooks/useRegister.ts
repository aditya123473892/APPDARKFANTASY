import { useState } from 'react';
import { authService } from '../services';
import { useAuthStore } from '../store/authStore';
import type { RegisterInput } from '../types';
export function useRegister() {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const register = async (input: RegisterInput): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await setAuthenticated(await authService.register(input));
      return true;
    } catch {
      setError('We couldn’t create your account. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };
  return { register, error, isLoading };
}
