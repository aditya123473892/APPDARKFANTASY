import type { Role } from './userModel';

const member = {
  canUseApp: true,
  canSendMessages: true,
  canShareMedia: true,
  canModerate: false,
  canViewAdminScreens: false,
  canRequestConnection: false,
  canCreateGroups: true,
};
/**
 * Chat/media/groups require a JWT, not a role. Any member can create a group
 * and owns it; membership and ownership are enforced by the server.
 */
export const permissions = {
  user: { ...member, canRequestConnection: true },
  manager: { ...member },
  // The moderation console is separate; this role grants no Android admin tools.
  moderator: { ...member },
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
