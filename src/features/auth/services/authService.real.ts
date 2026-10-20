import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { sessionFromToken } from '../session';
import { AuthError } from '../types';
import type { AuthService } from './authService';
import { parseUser, type User as BackendUser } from '../userModel';
type Envelope<T> = { data: T; error: false | string; message?: string; statusCode: number };
function unwrap<T>(body: Envelope<T>, login = false): T {
  if (body.error || body.statusCode >= 400) {
    if (body.statusCode >= 500) throw new AuthError('SERVER');
    if (body.message === "Your account isn't verified yet, Please check your email.")
      throw new AuthError('UNVERIFIED');
    if (
      body.message === 'Account blocked!, contact administrator Dark Fantasy' ||
      body.message?.startsWith('Your account has been blocked by system,') ||
      body.message?.startsWith('You account has been blocked by ')
    )
      throw new AuthError('BLOCKED');
    if (body.statusCode === 429) throw new AuthError('RATE_LIMITED');
    if (body.statusCode === 401)
      throw new AuthError(login ? 'INVALID_CREDENTIALS' : 'SESSION_EXPIRED');
    throw new AuthError(login ? 'INVALID_CREDENTIALS' : 'SERVER');
  }
  if (!body.data) throw new AuthError('SERVER');
  return body.data;
}
function translate(error: unknown, login = false): AuthError {
  if (error instanceof AuthError) return error;
  if (axios.isAxiosError(error)) {
    if (error.response?.data?.message === 'Account blocked!, contact administrator Dark Fantasy')
      return new AuthError('BLOCKED');
    if (!error.response) return new AuthError('NETWORK');
    if (error.response.status === 429) return new AuthError('RATE_LIMITED');
    // Backend and proxy outages must not be presented as incorrect passwords.
    if (error.response.status >= 500) return new AuthError('SERVER');
    if (login) return new AuthError('INVALID_CREDENTIALS');
    if (error.response.status === 401) return new AuthError('SESSION_EXPIRED');
  }
  return new AuthError('SERVER');
}
export const realAuthService: AuthService = {
  async login(input) {
    const body = { username: input.email.trim(), password: input.password };
    input.password = '';
    try {
      const response = await apiClient.post<Envelope<{ accessToken: string; user: BackendUser }>>(
        '/auth/login',
        body,
      );
      response.config.data = undefined;
      const data = unwrap(response.data, true);
      const session = sessionFromToken(data.accessToken);
      const responseMe = await apiClient.get<Envelope<BackendUser>>('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      const user = parseUser(unwrap(responseMe.data));
      if (user._id !== session.userId || data.user._id !== user._id)
        throw new AuthError('SESSION_EXPIRED');
      return { session, user };
    } catch (error) {
      if (axios.isAxiosError(error) && error.config) error.config.data = undefined;
      throw translate(error, true);
    } finally {
      body.password = '';
    }
  },
  async getCurrentUser(session) {
    try {
      sessionFromToken(session.accessToken);
      const response = await apiClient.get<Envelope<BackendUser>>('/auth/me');
      const user = parseUser(unwrap(response.data));
      if (user._id !== session.userId) throw new AuthError('SESSION_EXPIRED');
      return user;
    } catch (error) {
      throw translate(error);
    }
  },
  async logout() {},
  async refreshSession() {
    throw new AuthError('SESSION_EXPIRED');
  },
  async register(input) {
    const body = {
      username: input.email.trim(),
      password: input.password,
      firstName: input.name.trim(),
      lastName: input.lastName.trim(),
      age: Number(input.age),
      gender: input.gender.trim(),
      roles: ['user'],
    };
    input.password = '';
    try {
      const response = await apiClient.post<Envelope<{ message: string }>>('/auth/signup', body);
      response.config.data = undefined;
      if (response.data.message === 'Account already exists with this email!, go to login')
        throw new AuthError('EMAIL_IN_USE');
      unwrap(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.config) error.config.data = undefined;
      throw translate(error);
    } finally {
      body.password = '';
    }
  },
  async requestPasswordReset(email) {
    try {
      const response = await apiClient.post<Envelope<{ passwordRequest: boolean }>>(
        '/auth/forgot-password', { username: email.trim() },
      );
      response.config.data = undefined;
      unwrap(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.config) error.config.data = undefined;
      throw translate(error);
    }
  },
  async validateInviteCode() {
    return false;
  },
};
