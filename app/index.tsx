import { Redirect, type Href } from 'expo-router';
import { useAgeConsent } from '@/features/legal/ageConsentStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Loader } from '@/components/ui';
export default function IndexRoute(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  const ageConsent = useAgeConsent((state) => state.status);
  if (status === 'loading' || ageConsent === 'unknown') return <Loader />;
  return (
    <Redirect
      href={
        ageConsent === 'required'
          ? ('/age-check' as Href)
          : status === 'authenticated'
            ? '/home'
            : status === 'unauthenticated'
              ? '/welcome'
              : '/account-state'
      }
    />
  );
}
