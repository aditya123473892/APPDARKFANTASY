import { QueryClient } from '@tanstack/react-query';
import { isServiceError } from './errors';

/**
 * Shared client so auth can wipe cached user data on logout (no data leaks between accounts).
 * Not-found and validation errors are final; transient failures retry once.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !isServiceError(error, 'NOT_FOUND') && !isServiceError(error, 'VALIDATION') && count < 1,
    },
    mutations: { retry: false },
  },
});
