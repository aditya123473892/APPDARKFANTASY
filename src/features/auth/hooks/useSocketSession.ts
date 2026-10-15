import { useCurrentUserId } from './useCurrentUser';
import { sessionIdentity } from '../sessionRuntime';
/** Phase 2 consumes identity and subscribes to teardown. No socket is created here. */
export function useSocketSession() {
  const userId = useCurrentUserId();
  return { userId, getToken: sessionIdentity.getToken, subscribe: sessionIdentity.subscribe };
}
