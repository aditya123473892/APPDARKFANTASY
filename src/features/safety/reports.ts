import axios from 'axios';
import * as Network from 'expo-network';
import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap } from '@/services/api/backend';
import { isSessionCurrent, registerSessionTeardown, sessionIdentity } from '@/features/auth/sessionRuntime';
export const reportCategories = ['harassment', 'hate', 'spam_scam', 'fake_profile', 'nudity_sexual', 'violence_threat', 'underage', 'self_harm', 'impersonation', 'other'] as const;
export type ReportTarget = { targetType: 'user' | 'post' | 'comment' | 'chat_message' | 'chat_media' | 'group' | 'event'; targetId: string; messageId?: string };
export type ReportDraft = { category?: (typeof reportCategories)[number]; details: string; childSafetySuspected?: boolean };
const drafts = new Map<string, ReportDraft>();
const pending = new Set<string>();
export const reportKey = (target: ReportTarget) => `${target.targetType}:${target.targetId}:${target.messageId || ''}`;
export const getReportDraft = (target: ReportTarget): ReportDraft => drafts.get(reportKey(target)) || { details: '' };
export const setReportDraft = (target: ReportTarget, value: ReportDraft) => drafts.set(reportKey(target), value);
registerSessionTeardown(() => { drafts.clear(); pending.clear(); });
export async function submitReport(target: ReportTarget, draft: ReportDraft) {
  const key = reportKey(target), scope = sessionIdentity.generation;
  if (pending.has(key)) throw new Error('This report is already being submitted');
  if (!draft.category || !reportCategories.includes(draft.category) || draft.details.length > 500) throw new Error('Choose a category and keep the note within 500 characters');
  pending.add(key);
  setReportDraft(target, draft);
  try {
    const network = await Network.getNetworkStateAsync();
    if (!isSessionCurrent(scope)) throw new Error('Session ended');
    if (!network.isConnected || network.isInternetReachable === false) throw new Error('You are offline. Your draft stays in memory; reconnect and submit it yourself.');
    // Direct POST: no mutation persistence, automatic retry, background queue or disk draft.
    const response = await apiClient
      .post('/reports', { ...target, ...draft })
      .catch((error: unknown) => {
        throw new Error(reportErrorMessage(error));
      });
    if (!isSessionCurrent(scope)) throw new Error('Session ended');
    const result = unwrap<{ reportId: string; status: string; targetOwnerId: string }>(response.data);
    drafts.delete(key);
    return result;
  } finally { if (isSessionCurrent(scope)) pending.delete(key); }
}
/** Readable copy for report failures; the draft stays in memory either way. */
export function reportErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Could not submit. Your draft is still in memory.';
  const status = error.response?.status;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  if (status === 429) return 'You have sent a lot of reports recently. Please try again later.';
  if (status === 404) return 'This content is no longer available to report.';
  if (status === 403)
    return typeof message === 'string' && message.length <= 200
      ? message
      : 'You cannot report this content.';
  if (!error.response) return 'Connection problem. Your draft is still in memory; please try again.';
  return 'Could not submit. Your draft is still in memory.';
}
export type ReportPage ={ reports: { reportId: string; status: string; createdAt: string }[]; nextCursor: string | null };
export const myReports = (before?: string) => getData<ReportPage>('/reports/me', { limit: 20, ...(before ? { before } : {}) });
export const reportNotices = () => getData<{ message: string; createdAt: string; metadata?: { reportId?: string } }[]>('/reports/notices');
