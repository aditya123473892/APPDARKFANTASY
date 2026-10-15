import { useAuthStore } from '../store/authStore';
export function useSession() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.currentUser);
  const session = useAuthStore((state) => state.session);
  return { status, user, session };
}
