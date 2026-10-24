import { getAuthRevision, useAuthStore } from './store/authStore';
import { AuthError, type AuthResult } from './types';

/**
 * Stores a phone OTP session exactly like the former password login: SecureStore
 * persistence, identity checks, and the same blocked/unverified account states.
 */
export async function completePhoneSignIn(task: () => Promise<AuthResult>): Promise<void> {
  const store = useAuthStore.getState();
  const attempt = store.beginLogin();
  try {
    const result = await task();
    if (attempt === getAuthRevision()) await store.setAuthenticated(result);
  } catch (error) {
    if (
      error instanceof AuthError &&
      ['BLOCKED', 'UNVERIFIED'].includes(error.code) &&
      attempt === getAuthRevision()
    )
      useAuthStore.setState({ status: error.code === 'BLOCKED' ? 'blocked' : 'unverified' });
    throw error;
  }
}
