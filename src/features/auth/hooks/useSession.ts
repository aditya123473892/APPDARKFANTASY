import { useAuthStore } from '../store/authStore';
export function useSession() {
  return useAuthStore((state) => ({
    status: state.status,
    user: state.user,
    session: state.session,
  }));
}
