import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
export function useAppState(): AppStateStatus {
  const [state, setState] = useState<AppStateStatus>(() => {
    const current = AppState.currentState;
    return current === 'active' || current === 'background' || current === 'inactive' || current === 'extension'
      ? current
      : 'unknown';
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  return state;
}
