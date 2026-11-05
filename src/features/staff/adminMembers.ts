import { apiClient } from '@/services/api/apiClient';
import { getData, mediaUrl, serviceError, unwrap } from '@/services/api/backend';
import { displayName } from '@/features/auth/userModel';

export type MemberFilter = 'all' | 'premium' | 'normal';
/** Grant length in months, or lifetime (never expires). */
export type PremiumGrant = { months: number } | { lifetime: true };

export type AdminMember = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  roles: string[];
  blocked: boolean;
  premium: boolean;
  lifetime: boolean;
  premiumUntil: string | null;
};
type BackendMember = {
  _id: string;
  displayname?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  roles?: string[];
  isBlocked?: boolean;
  premium?: boolean;
  lifetime?: boolean;
  premiumUntil?: string | null;
};

function mapMember(raw: BackendMember): AdminMember {
  return {
    id: raw._id,
    name: displayName(raw),
    username: raw.username ?? '',
    avatar: mediaUrl(raw.avatar),
    roles: raw.roles ?? [],
    blocked: !!raw.isBlocked,
    premium: !!raw.premium,
    lifetime: !!raw.lifetime,
    premiumUntil: raw.premiumUntil ?? null,
  };
}

export function premiumLabel(member: AdminMember): string {
  if (!member.premium) return 'Normal';
  if (member.lifetime || !member.premiumUntil) return 'Premium · lifetime';
  return `Premium until ${new Date(member.premiumUntil).toLocaleDateString()}`;
}

export async function listMembers(filter: MemberFilter, search: string, before?: string) {
  const data = await getData<{ users: BackendMember[]; nextCursor: string | null }>(
    '/admin/users',
    {
      filter,
      ...(search ? { search } : {}),
      ...(before ? { before } : {}),
    },
  );
  return { users: (data.users ?? []).map(mapMember), nextCursor: data.nextCursor };
}

/** Grant (extends any remaining time) or revoke premium. Pass null to revoke. */
export async function setMemberPremium(
  id: string,
  grant: PremiumGrant | null,
): Promise<AdminMember> {
  try {
    const body = grant ? { premium: true, ...grant } : { premium: false };
    const data = unwrap<{ user: BackendMember }>(
      (await apiClient.patch(`/admin/users/${id}/premium`, body)).data,
    );
    return mapMember(data.user);
  } catch (error) {
    throw serviceError(error);
  }
}
