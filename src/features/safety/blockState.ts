import { create } from 'zustand';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';

export const useBlockState = create(() => ({
  ids: [] as string[],
  pending: [] as string[],
  version: 0,
}));
export const isPeerBlocked = (id: string) => useBlockState.getState().ids.includes(id);
export function setPeerBlocked(id: string, blocked: boolean) {
  useBlockState.setState((state) => ({
    ids: blocked ? [...new Set([...state.ids, id])] : state.ids.filter((value) => value !== id),
    version: state.version + 1,
  }));
}
registerSessionTeardown(() => useBlockState.setState({ ids: [], pending: [], version: 0 }));
