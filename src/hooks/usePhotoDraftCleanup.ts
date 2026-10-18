import { useEffect, useRef } from 'react';
import { cleanupPickedAssets } from '@/services/api/photoUpload';
import type { UploadAsset } from '@/features/feed/types';

export function usePhotoDraftCleanup(assets: UploadAsset[]) {
  const latest = useRef<UploadAsset[]>([]);
  useEffect(() => {
    const kept = new Set(assets.map((asset) => asset.uri));
    void cleanupPickedAssets(latest.current.filter((asset) => !kept.has(asset.uri)));
    latest.current = assets;
  }, [assets]);
  useEffect(
    () => () => {
      void cleanupPickedAssets(latest.current);
    },
    [],
  );
}
