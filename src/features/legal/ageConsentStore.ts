import { create } from 'zustand';
import { secureStorage } from '@/services/storage/secureStorage';
import { logger } from '@/utils/logger';

type AgeConsentState = {
  /** 'unknown' until read from the device. */
  status: 'unknown' | 'required' | 'confirmed';
  hydrate: () => Promise<void>;
  confirm: () => Promise<void>;
};

/** The 18+ confirmation, remembered on this device only. */
export const useAgeConsent = create<AgeConsentState>((set) => ({
  status: 'unknown',
  hydrate: async () => {
    try {
      set({ status: (await secureStorage.getAgeConfirmedAt()) ? 'confirmed' : 'required' });
    } catch {
      logger.debug('Age confirmation could not be read');
      set({ status: 'required' });
    }
  },
  confirm: async () => {
    set({ status: 'confirmed' });
    try {
      await secureStorage.setAgeConfirmedAt(new Date().toISOString());
    } catch {
      // Still confirmed for this session; the check is shown again next launch.
      logger.debug('Age confirmation could not be saved');
    }
  },
}));
