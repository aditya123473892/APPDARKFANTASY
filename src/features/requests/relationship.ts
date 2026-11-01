export type FollowRelationship = { status: 'none' | 'requested' | 'following'; requestId?: string };
export const relationshipKey = (id: string) => ['relationships', id] as const;
export const relationshipChanging = new Set<string>();
export const followLabel = (state: FollowRelationship['status']) =>
  state === 'following' ? 'Following' : state === 'requested' ? 'Requested' : 'Follow';
