import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import {
  sessionIdentity,
  invalidateSession,
  registerSessionTeardown,
  notifyForbidden,
} from '@/features/auth/sessionRuntime';
import { initializePinning } from './pinning';
import { useBlockState } from '@/features/safety/blockState';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionGeneration?: number;
  _blockVersion?: number;
};
function assertRequestSession(config?: RetryConfig): void {
  if (config?._sessionGeneration !== sessionIdentity.generation)
    throw new axios.CanceledError('Session ended');
}
let requests = new AbortController();
registerSessionTeardown(() => {
  requests.abort();
  requests = new AbortController();
});
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  maxRedirects: 0,
});
apiClient.interceptors.request.use(async (config) => {
  const guarded = config as RetryConfig;
  guarded._sessionGeneration ??= sessionIdentity.generation;
  guarded._blockVersion ??= useBlockState.getState().version;
  assertRequestSession(guarded);
  const scope = requests;
  await initializePinning();
  assertRequestSession(guarded);
  if (scope.signal.aborted) throw new axios.CanceledError('Session ended');
  config.signal = scope.signal;
  const target = new URL(apiClient.getUri(config));
  if (target.origin !== new URL(env.apiUrl).origin || target.username || target.password)
    throw new Error('API requests must stay on the configured origin');
  if (
    [...target.searchParams.keys()].some((key) =>
      /^(token|access_?token|authorization|password)$/i.test(key),
    )
  )
    throw new Error('Credentials are forbidden in request URLs');
  if (!__DEV__ && target.protocol !== 'https:') throw new Error('HTTPS is required');
  const token = sessionIdentity.getToken();
  if (config.url === '/auth/login') config.headers.delete('Authorization');
  else if (!config.headers.Authorization && token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(
  async (response) => {
    assertRequestSession(response.config);
    if (
      response.config.method === 'get' &&
      /^\/(users|posts|events|event-members|groups|chats|notifications)(\/|$)/.test(
        response.config.url || '',
      ) &&
      response.config.url !== '/users/me/blocks' &&
      (response.config as RetryConfig)._blockVersion !== useBlockState.getState().version
    )
      throw new axios.CanceledError('Visibility changed during request');
    if ([401, 403].includes(response.data?.statusCode)) {
      if (response.data.statusCode === 401)
        await invalidateSession(
          response.config.headers.Authorization,
          response.config.url === '/auth/me' &&
            response.data.message === 'Account blocked!, contact administrator Dark Fantasy',
        );
      else if (!['/auth/me', '/reports'].includes(response.config.url || ''))
        await notifyForbidden(response.config.headers.Authorization);
      throw new AxiosError(
        response.data.statusCode === 403
          ? 'You are not permitted to perform this action.'
          : 'Session rejected',
        'ERR_BAD_RESPONSE',
        response.config,
        undefined,
        response,
      );
    }
    return response;
  },
  async (error: AxiosError<{ message?: string }>) => {
    const config = error.config as RetryConfig | undefined;
    if (config) assertRequestSession(config);
    if (error.response?.status === 401)
      await invalidateSession(
        config?.headers.Authorization,
        config?.url === '/auth/me' &&
          error.response?.data?.message === 'Account blocked!, contact administrator Dark Fantasy',
      );
    // A report 403 means "not reportable" (own content, no prior access), not a
    // revoked role: keep its message and skip the session-wide permission refresh.
    if (error.response?.status === 403 && config?.url !== '/reports') {
      error.message = 'You are not permitted to perform this action.';
      if (config?.url !== '/auth/me') await notifyForbidden(config?.headers.Authorization);
    }
    if (
      !axios.isCancel(error) &&
      !config?.signal?.aborted &&
      config?.method === 'get' &&
      !config._retry &&
      (!error.response || [502, 503, 504].includes(error.response.status))
    ) {
      config._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (config.signal?.aborted) throw new axios.CanceledError('Session ended');
      return apiClient(config);
    }
    return Promise.reject(error);
  },
);
