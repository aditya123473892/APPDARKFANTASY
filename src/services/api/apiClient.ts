import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { authService } from '@/features/auth/services';
import { useAuthStore } from '@/features/auth/store/authStore';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };
let refreshPromise: Promise<string> | null = null;

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const authState = useAuthStore.getState();
    if (error.response?.status !== 401 || !config || config._retry || !authState.session)
      return Promise.reject(error);
    config._retry = true;
    refreshPromise ??= authService
      .refreshSession(authState.session.refreshToken)
      .then(async (session) => {
        if (!authState.user) throw error;
        await authState.setAuthenticated({ session, user: authState.user });
        return session.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
    try {
      config.headers.Authorization = `Bearer ${await refreshPromise}`;
      return apiClient(config);
    } catch (refreshError) {
      await useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    }
  },
);

// TODO(backend): Import and call this client only from real feature services.
