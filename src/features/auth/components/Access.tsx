import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loader } from '@/components/ui';
import { useAuthStore } from '../store/authStore';
import { useCan, useHasRole } from '../hooks/useCurrentUser';
import type { Capability } from '../permissions';
import type { Role } from '../userModel';
type Content = { children: ReactNode; fallback?: ReactNode; disabled?: boolean };
function ContentGate({
  allowed,
  children,
  fallback = null,
  disabled,
}: Content & { allowed: boolean }) {
  if (allowed) return <>{children}</>;
  return disabled ? (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: 0.4 }}
    >
      {children}
    </View>
  ) : (
    <>{fallback}</>
  );
}
export function Can({ capability, ...props }: Content & { capability: Capability }) {
  return <ContentGate allowed={useCan(capability)} {...props} />;
}
export function RequireRole({ roles, ...props }: Content & { roles: Role[] }) {
  return <ContentGate allowed={useHasRole(roles)} {...props} />;
}
export function ProtectedRoute({
  capability = 'canUseApp',
  children,
}: {
  capability?: Capability;
  children: ReactNode;
}) {
  const status = useAuthStore((s) => s.status);
  const allowed = useCan(capability);
  if (status === 'loading') return <Loader />;
  if (status === 'unauthenticated') return <Redirect href="/login" />;
  if (status !== 'authenticated') return <Redirect href="/account-state" />;
  if (!allowed) return <Redirect href="/not-allowed" />;
  return <>{children}</>;
}
