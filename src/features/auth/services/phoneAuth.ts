import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { AuthError, type AuthErrorCode, type AuthResult, type RegisterInput } from '../types';
import type { User as BackendUser } from '../userModel';
import { sessionFromSignIn } from './authService.real';

type Envelope<T> = { data: T; error: false | string; message?: string; statusCode: number };
type Session = { user: BackendUser; accessToken: string };

const SERVER_CODES: Record<string, AuthErrorCode> = {
  PHONE_INVALID: 'PHONE_INVALID',
  PHONE_UNSUPPORTED: 'PHONE_UNSUPPORTED',
  PHONE_IN_USE: 'PHONE_IN_USE',
  PHONE_ALREADY_LINKED: 'PHONE_ALREADY_LINKED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  OTP_CHECK_LIMIT: 'OTP_CHECK_LIMIT',
  OTP_SEND_LIMIT: 'RATE_LIMITED',
  OTP_RATE_LIMITED: 'RATE_LIMITED',
  OTP_UNAVAILABLE: 'OTP_UNAVAILABLE',
  SIGNUP_SESSION_INVALID: 'SIGNUP_SESSION_INVALID',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
};
const BLOCKED = /^(Your account has been blocked by system,|You account has been blocked by )/;

function translate(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (axios.isAxiosError(error)) {
    if (error.config) error.config.data = undefined;
    const body = error.response?.data as { error?: string; message?: string } | undefined;
    if (!error.response) return new AuthError('NETWORK');
    const code = body?.error ? SERVER_CODES[body.error] : undefined;
    if (code) return new AuthError(code);
    if (body?.message === "Your account isn't verified yet, Please check your email.")
      return new AuthError('UNVERIFIED');
    if (body?.message && BLOCKED.test(body.message)) return new AuthError('BLOCKED');
    if (error.response.status === 429) return new AuthError('RATE_LIMITED');
    if (error.response.status === 401) return new AuthError('INVALID_CREDENTIALS');
  }
  return new AuthError('SERVER');
}

async function post<T>(url: string, body: object, bootstrapToken?: string): Promise<T> {
  try {
    const response = await apiClient.post<Envelope<T>>(url, body, {
      headers: bootstrapToken ? { Authorization: `Bearer ${bootstrapToken}` } : undefined,
    });
    response.config.data = undefined;
    if (response.data.error || response.data.statusCode >= 400 || !response.data.data)
      throw new AuthError(response.data.statusCode >= 500 ? 'SERVER' : 'UNKNOWN');
    return response.data.data;
  } catch (error) {
    throw translate(error);
  }
}

async function signIn(result: Session): Promise<AuthResult> {
  try {
    return await sessionFromSignIn(result.accessToken, result.user._id);
  } catch (error) {
    throw translate(error);
  }
}

/** Phone number + Twilio Verify OTP: the only sign-in method in the mobile app. */
export const phoneAuth = {
  /** Same response whether or not the number has an account. */
  async sendLoginCode(phone: string): Promise<number> {
    return (
      await post<{ resendAfterSeconds: number }>('/auth/otp/send', { phone, purpose: 'login' })
    ).resendAfterSeconds;
  },
  async verifyLoginCode(phone: string, code: string): Promise<AuthResult> {
    return signIn(await post<Session>('/auth/otp/verify', { phone, code }));
  },

  async sendSignupCode(phone: string): Promise<number> {
    return (
      await post<{ resendAfterSeconds: number }>('/auth/otp/send', { phone, purpose: 'signup' })
    ).resendAfterSeconds;
  },
  /** Returns a short-lived token proving the number, used to create the account. */
  async verifySignupCode(phone: string, code: string): Promise<string> {
    return (await post<{ signupToken: string }>('/auth/otp/signup/verify', { phone, code }))
      .signupToken;
  },
  /** Null when the account exists but its email must be verified before sign-in. */
  async completeSignup(input: RegisterInput, signupToken: string): Promise<AuthResult | null> {
    const body = {
      signupToken,
      username: input.email.trim(),
      password: input.password,
      firstName: input.name.trim(),
      lastName: input.lastName.trim(),
      age: Number(input.age),
      gender: input.gender.trim(),
    };
    input.password = '';
    try {
      const result = await post<{ emailVerificationRequired: boolean } & Partial<Session>>(
        '/auth/otp/signup',
        body,
      );
      if (result.emailVerificationRequired || !result.accessToken || !result.user) return null;
      return await signIn(result as Session);
    } finally {
      body.password = '';
    }
  },

  /** Existing account without a verified phone: one password check that can only add a phone. */
  async startPhoneSetup(email: string, password: string): Promise<string> {
    const body = { username: email.trim(), password };
    try {
      return (await post<{ bootstrapToken: string }>('/auth/phone/bootstrap', body)).bootstrapToken;
    } finally {
      body.password = '';
    }
  },
  /** Session-authenticated when no bootstrap token is given (settings: change number). */
  async sendLinkCode(phone: string, bootstrapToken?: string): Promise<number> {
    return (
      await post<{ resendAfterSeconds: number }>('/auth/phone/send', { phone }, bootstrapToken)
    ).resendAfterSeconds;
  },
  /** Bootstrap: returns the new phone session. Settings: returns null (session unchanged). */
  async verifyLinkCode(
    phone: string,
    code: string,
    bootstrapToken?: string,
  ): Promise<AuthResult | null> {
    const result = await post<Partial<Session>>(
      '/auth/phone/verify',
      { phone, code },
      bootstrapToken,
    );
    return bootstrapToken && result.accessToken && result.user ? signIn(result as Session) : null;
  },
};

export function phoneErrorMessage(error: unknown): string {
  const code = error instanceof AuthError ? error.code : 'SERVER';
  switch (code) {
    case 'PHONE_INVALID':
      return 'Enter a valid mobile number.';
    case 'PHONE_UNSUPPORTED':
      return "This number can't receive verification codes. Try another number.";
    case 'PHONE_IN_USE':
      return 'This number is already linked to another account. Sign in with it instead.';
    case 'PHONE_ALREADY_LINKED':
      return 'Your account already has phone sign-in. Use your phone number to sign in.';
    case 'OTP_INVALID':
      return 'That code is incorrect. Check the SMS and try again.';
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new code.';
    case 'OTP_CHECK_LIMIT':
      return 'Too many incorrect codes. Request a new code.';
    case 'OTP_COOLDOWN':
      return 'Please wait a moment before requesting another code.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please try again later.';
    case 'SIGNUP_SESSION_INVALID':
      return 'Your phone verification expired. Verify your number again.';
    case 'EMAIL_IN_USE':
      return 'An account with this email already exists. Set up phone sign-in from the sign-in screen.';
    case 'INVALID_CREDENTIALS':
      return 'Unable to sign in. Check your email and password.';
    case 'UNVERIFIED':
      return 'Verify your email first, then sign in with your phone number.';
    case 'BLOCKED':
      return 'This account is blocked. Contact support through the desktop website.';
    case 'NETWORK':
      return 'Unable to reach the server. Check your connection and try again.';
    default:
      return 'Phone verification is unavailable. Please try again later.';
  }
}
