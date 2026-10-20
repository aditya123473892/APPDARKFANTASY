import { apiClient } from '@/services/api/apiClient';
import { getData, unwrap } from '@/services/api/backend';
import { assertSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';
import { useBlockState } from './blockState';
export type BlockedUser = { id: string; name: string; createdAt: string };
export type BlockPage = { blocks: BlockedUser[]; nextCursor: string | null };
export const listBlocks = (before?: string) =>
  getData<BlockPage>('/users/me/blocks', { limit: 100, ...(before ? { before } : {}) });
export async function changeBlock(id: string, blocked: boolean) {
  unwrap(
    (
      await (blocked
        ? apiClient.post(`/users/${id}/block`, {})
        : apiClient.delete(`/users/${id}/block`))
    ).data,
  );
}
export async function refreshBlockState() {
  const scope = sessionIdentity.generation;
  const version = useBlockState.getState().version;
  let before: string | undefined;
  const rows: BlockedUser[] = [];
  do {
    const page = await listBlocks(before);
    rows.push(...page.blocks);
    before = page.nextCursor ?? undefined;
  } while (before);
  assertSessionCurrent(scope);
  if (useBlockState.getState().version === version && !useBlockState.getState().pending.length)
    useBlockState.setState({ ids: rows.map((row) => row.id), version: version + 1 });
  return rows;
}
