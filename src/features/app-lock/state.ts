import { create } from 'zustand';
import type { LockConfig } from './service';
export const useAppLock = create<{ owner: string | null; ready: boolean; locked: boolean; config: LockConfig | null; error: string }>(() => ({
  owner: null, ready: false, locked: true, config: null, error: '',
}));
