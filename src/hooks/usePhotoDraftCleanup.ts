import { useCallback, useEffect, useRef } from 'react';
import { cleanupPickedAssets } from '@/services/api/photoUpload';
import type { UploadAsset } from '@/features/feed/types';

/**
 * Deletes picker/crop cache files when they leave the draft or the screen closes.
 * Returns `handOff`: assets passed to it now belong to someone else (a background
 * upload) and are never deleted here.
 */
export function usePhotoDraftCleanup(assets: UploadAsset[]) {
  const latest = useRef<UploadAsset[]>([]);
  const handed = useRef(new Set<string>());
  useEffect(() => {
    const kept = new Set(assets.map((asset) => asset.uri));
    void cleanupPickedAssets(
      latest.current.filter((asset) => !kept.has(asset.uri) && !handed.current.has(asset.uri)),
    );
    latest.current = assets;
  }, [assets]);
  useEffect(
    () => () => {
      void cleanupPickedAssets(latest.current.filter((asset) => !handed.current.has(asset.uri)));
    },
    [],
  );
  return useCallback((owned: UploadAsset[]) => {
    for (const asset of owned) handed.current.add(asset.uri);
  }, []);
}
