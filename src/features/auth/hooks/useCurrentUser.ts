import { useAuthStore } from '../store/authStore';
import { hasCapability, hasRole, type Capability } from '../permissions';
import type { Role } from '../userModel';
export const useCurrentUser = () => useAuthStore((s) => s.currentUser);
export const useCurrentUserId = () => useAuthStore((s) => s.currentUser?._id ?? null);
export const useRoles = () => useAuthStore((s) => s.roles);
export const useHasRole = (roles: Role | Role[]) =>
  useAuthStore((s) => s.status === 'authenticated' && hasRole(s.roles, roles));
export const useCan = (capability: Capability) =>
  useAuthStore((s) => s.status === 'authenticated' && hasCapability(s.roles, capability));
export const useIsVerified = () => useAuthStore((s) => s.currentUser?.isEmailVerified === true);
export const useIsBlocked = () =>
  useAuthStore((s) => s.currentUser?.isBlocked === true || s.status === 'blocked');
