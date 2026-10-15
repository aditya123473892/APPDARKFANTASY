import { jwtDecode } from 'jwt-decode';
import { AuthError, type Session } from './types';
export const EXPIRY_MARGIN_MS = 30_000;
export function sessionFromToken(accessToken: string): Session {
  try {
    // Unverified claims only expire early; /auth/me establishes identity.
    const { exp, sub } = jwtDecode<{ exp?: number; sub?: string }>(accessToken);
    if (
      !Number.isFinite(exp) ||
      typeof sub !== 'string' ||
      !sub ||
      exp! * 1000 <= Date.now() + EXPIRY_MARGIN_MS
    )
      throw new Error();
    return { accessToken, expiresAt: new Date(exp! * 1000).toISOString(), userId: sub };
  } catch {
    throw new AuthError('SESSION_EXPIRED');
  }
}
