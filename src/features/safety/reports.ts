import * as Network from 'expo-network';
import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap } from '@/services/api/backend';
import { isSessionCurrent, registerSessionTeardown, sessionIdentity } from '@/features/auth/sessionRuntime';
export const reportCategories = ['harassment', 'hate', 'spam_scam', 'fake_profile', 'nudity_sexual', 'violence_threat', 'underage', 'self_harm', 'impersonation', 'other'] as const;
export type ReportTarget = { targetType: 'user' | 'post' | 'chat_message' | 'chat_media' | 'group' | 'event'; targetId: string; messageId?: string };
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
    const response = await apiClient.post('/reports', { ...target, ...draft });
    if (!isSessionCurrent(scope)) throw new Error('Session ended');
    const result = unwrap<{ reportId: string; status: string; targetOwnerId: string }>(response.data);
    drafts.delete(key);
    return result;
  } finally { if (isSessionCurrent(scope)) pending.delete(key); }
}
export type ReportPage = { reports: { reportId: string; status: string; createdAt: string }[]; nextCursor: string | null };
export const myReports = (before?: string) => getData<ReportPage>('/reports/me', { limit: 20, ...(before ? { before } : {}) });
export const reportNotices = () => getData<{ message: string; createdAt: string; metadata?: { reportId?: string } }[]>('/reports/notices');
