export type EntityId = string;
export type LoadableStatus = 'idle' | 'loading' | 'success' | 'error';

/** Presence is only returned when the other person shares it and the viewer's privacy settings allow it. */
export type Presence = { online: boolean; lastSeenAt: string | null };

/** How the signed-in user is related to another profile. */
export type Relationship =
  | { status: 'none' }
  | { status: 'outgoing'; requestId: string }
  | { status: 'incoming'; requestId: string }
  | { status: 'connected'; conversationId: string };
