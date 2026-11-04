import { useState } from 'react';

/**
 * Spinner state for a pull-to-refresh gesture only. `isRefetching` is also true
 * for background refetches (polling, returning to the app, invalidation), which
 * made the spinner appear and the list shift on its own.
 */
export function usePullToRefresh(refresh: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}
