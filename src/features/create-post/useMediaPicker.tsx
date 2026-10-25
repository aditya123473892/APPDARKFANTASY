import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Modal, Text } from '@/components/ui';
import type { UploadAsset } from '@/features/feed/types';
import { registerSessionTeardown } from '@/features/auth/sessionRuntime';
import { cleanupPickedAssets } from '@/services/api/photoUpload';
import { pickMedia as pickGalleryMedia } from './pickMedia';

const VaultMediaPicker = lazy(() => import('@/features/vault/components/VaultMediaPicker'));

/** Shared source chooser for post media and chat attachments. */
export function useMediaPicker() {
  const [stage, setStage] = useState<'source' | 'vault' | null>(null);
  const [error, setError] = useState('');
  const pending = useRef<((assets: UploadAsset[]) => void) | null>(null);
  const finish = useCallback((assets: UploadAsset[]) => {
    const resolve = pending.current;
    pending.current = null;
    setStage(null);
    if (resolve) resolve(assets);
    else void cleanupPickedAssets(assets);
  }, []);

  useEffect(() => {
    const unsubscribe = registerSessionTeardown(() => finish([]));
    return () => {
      unsubscribe();
      const resolve = pending.current;
      pending.current = null;
      resolve?.([]);
    };
  }, [finish]);

  const pickMedia = useCallback((): Promise<UploadAsset[]> => {
    if (pending.current) return Promise.resolve([]);
    return new Promise((resolve) => {
      pending.current = resolve;
      setError('');
      setStage('source');
    });
  }, []);

  const picker = (
    <>
      <Modal visible={stage === 'source'} title="Choose media source" onClose={() => finish([])}>
        {Platform.OS === 'android' ? (
          <Button
            label="Upload from vault"
            icon="lock-closed-outline"
            onPress={() => {
              setError('');
              setStage('vault');
            }}
          />
        ) : null}
        <Button
          label="Upload from gallery"
          icon="images-outline"
          variant="secondary"
          onPress={() => {
            const request = pending.current;
            setError('');
            setStage(null);
            void pickGalleryMedia()
              .then((assets) => {
                if (pending.current === request) finish(assets);
                else void cleanupPickedAssets(assets);
              })
              .catch((cause: unknown) => {
                if (!request || pending.current !== request) return;
                setError(
                  cause instanceof Error ? cause.message : 'Unable to open your photo library.',
                );
                setStage('source');
              });
          }}
        />
        {error ? <Text color="danger">{error}</Text> : null}
        <Button label="Cancel" variant="ghost" onPress={() => finish([])} />
      </Modal>
      {stage === 'vault' ? (
        <Suspense fallback={null}>
          <VaultMediaPicker onSelect={finish} onClose={() => finish([])} />
        </Suspense>
      ) : null}
    </>
  );
  return { pickMedia, picker };
}
