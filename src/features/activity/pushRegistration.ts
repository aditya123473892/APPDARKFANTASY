import { apiClient } from '@/services/api/apiClient';
let token: string | null = null;
export function rememberPushToken(value: string) { token = value; }
export async function unregisterPushDevice() {
  const previous = token;
  token = null;
  if (previous) await apiClient.delete('/notifications/push-token', { data: { token: previous }, timeout: 3000 }).catch(() => undefined);
}
