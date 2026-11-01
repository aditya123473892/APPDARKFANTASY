import type { RequestsResult } from './types';

/** Restore only the failed row. Other requests may have completed since the snapshot. */
export function restoreRequest(current: RequestsResult | undefined, previous: RequestsResult | undefined, id: string) {
  if (!current || !previous) return current;
  for (const direction of ['incoming', 'outgoing'] as const) {
    const index = previous[direction].findIndex(request => request.id === id);
    const request = previous[direction][index];
    if (!request || current[direction].some(row => row.id === id)) continue;
    const rows = [...current[direction]];
    rows.splice(Math.min(index, rows.length), 0, request);
    return { ...current, [direction]: rows };
  }
  return current;
}
