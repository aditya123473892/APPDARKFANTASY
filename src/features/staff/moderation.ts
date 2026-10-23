import axios from 'axios';
import { apiClient } from '@/services/api/apiClient';
import { unwrap } from '@/services/api/backend';

export type CaseStatus = 'open' | 'in_review' | 'escalated' | 'actioned' | 'dismissed';
export type ModCase = {
  reportId: string;
  targetType: string;
  targetId: string;
  targetOwnerId: string;
  category: string;
  status: CaseStatus;
  priority?: string;
  restricted?: boolean;
  assignedModerator?: string | null;
  createdAt: string;
  revision: number;
  details?: string;
};
export type ModEvidence = {
  evidenceId: string;
  snapshot?: Record<string, unknown>;
  context?: Record<string, unknown>[];
  images?: { evidenceId: string; state: string }[];
};
export type ModPerson = { id: string; name: string; handle: string; restricted: boolean };
export type ModBlock = { id: string; createdAt: string; blocker: ModPerson; blocked: ModPerson };
export type BlockSummary = {
  user: ModPerson;
  blocks: number;
  lastBlockedAt: string;
  openReports: number;
};
export type ModAction =
  'dismiss' | 'warn' | 'soft_remove' | 'suspend' | 'escalate' | 'ban' | 'delete_account';

/** Readable copy for moderation API failures (the API is off unless MOD_API_ENABLED=on). */
export function moderationError(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const message = axios.isAxiosError(error)
    ? (error.response?.data as { message?: unknown })?.message
    : undefined;
  if (status === 404 && typeof message === 'string' && message.startsWith('Cannot '))
    return 'Moderation is turned off on the server (MOD_API_ENABLED).';
  if (status === 403)
    return typeof message === 'string' && message.length < 200
      ? message
      : 'You don’t have access to this case.';
  if (status === 409) return 'This case changed. Refresh and try again.';
  if (status === 400) return 'Add a note (and a valid end date for suspensions) before acting.';
  if (!axios.isAxiosError(error) || !error.response) return 'Connection problem. Try again.';
  return 'The moderation request could not be completed.';
}
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  try {
    return unwrap<T>((await apiClient.get(url, { params })).data);
  } catch (error) {
    throw new Error(moderationError(error));
  }
}
export const listCases = (before?: string) =>
  get<{ cases: ModCase[]; nextCursor: string | null }>(
    '/mod/reports',
    before ? { before } : undefined,
  );
export const caseDetail = (id: string) =>
  get<ModCase & { evidence: ModEvidence[] }>(`/mod/reports/${encodeURIComponent(id)}`);
export const listModBlocks = (before?: string) =>
  get<{ blocks: ModBlock[]; nextCursor: string | null }>(
    '/mod/blocks',
    before ? { before } : undefined,
  );
export const blockSummary = () => get<BlockSummary[]>('/mod/blocks/summary');

async function mutate(path: string, method: 'patch' | 'post', body: Record<string, unknown>) {
  try {
    return unwrap<ModCase>((await apiClient[method](path, body)).data);
  } catch (error) {
    throw new Error(moderationError(error));
  }
}
export const startReview = (item: ModCase, note: string) =>
  mutate(`/mod/reports/${encodeURIComponent(item.reportId)}/status`, 'patch', {
    status: 'in_review',
    revision: item.revision,
    note,
  });
export const takeAction = (
  item: ModCase,
  action: ModAction,
  note: string,
  suspendedUntil?: string,
) =>
  mutate(`/mod/reports/${encodeURIComponent(item.reportId)}/actions`, 'post', {
    action,
    revision: item.revision,
    note,
    ...(suspendedUntil ? { suspendedUntil } : {}),
  });
