import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Loader } from '@/components/ui';
export default function IndexRoute(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  if (status === 'loading') return <Loader />;
  return (
    <Redirect
      href={
        status === 'authenticated'
          ? '/home'
          : status === 'unauthenticated'
            ? '/welcome'
            : '/account-state'
      }
    />
  );
}
