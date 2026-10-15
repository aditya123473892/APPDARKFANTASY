import { QueryClient } from '@tanstack/react-query';
import { isServiceError } from './errors';
import axios from 'axios';

/**
 * Shared client so auth can wipe cached user data on logout (no data leaks between accounts).
 * Not-found and validation errors are final; transient failures retry once.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !(
          axios.isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? error.response?.data?.statusCode)
        ) &&
        !isServiceError(error, 'NOT_FOUND') &&
        !isServiceError(error, 'FORBIDDEN') &&
        !isServiceError(error, 'VALIDATION') &&
        count < 1,
    },
    mutations: { retry: false },
  },
});

// Chat histories and local search live for the session; auth teardown removes them.
queryClient.setQueryDefaults(['chat'], { gcTime: Infinity });
