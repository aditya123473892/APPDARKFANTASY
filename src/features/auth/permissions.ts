import type { Role } from './userModel';

const member = {
  canUseApp: true,
  canSendMessages: true,
  canShareMedia: true,
  canModerate: false,
  canViewAdminScreens: false,
  canRequestConnection: false,
  canCreateGroups: false,
};
/** Chat/media require JWT, not a role; resource membership/ownership remains server enforced. */
export const permissions = {
  user: { ...member, canRequestConnection: true },
  manager: { ...member },
  admin: { ...member, canModerate: true, canViewAdminScreens: true, canCreateGroups: true },
  root: { ...member, canModerate: true, canViewAdminScreens: true, canCreateGroups: true },
} satisfies Record<Role, Record<string, boolean>>;
export type Capability = keyof typeof member;
export function hasCapability(roles: readonly Role[], capability: Capability): boolean {
  if (!roles.length || roles.some((role) => !Object.hasOwn(permissions, role))) return false;
  return roles.some((role) => permissions[role][capability]);
}
export function hasRole(roles: readonly Role[], required: Role | readonly Role[]): boolean {
  if (!roles.length || roles.some((role) => !Object.hasOwn(permissions, role))) return false;
  return (
    roles.includes('root') ||
    (Array.isArray(required) ? required : [required]).some((role) => roles.includes(role))
  );
}
