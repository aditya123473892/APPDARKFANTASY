import { create } from 'zustand';

export type PushState = 'checking' | 'ready' | 'denied' | 'unavailable' | 'error';
/** No device tokens or account data are exposed to notification settings. */
export const usePushStatus = create<{ status: PushState; message: string; revision: number }>(
  () => ({
    status: 'checking',
    message: 'Checking notification settings…',
    revision: 0,
  }),
);
export const retryPushRegistration = () =>
  usePushStatus.setState((s) => ({ revision: s.revision + 1 }));
