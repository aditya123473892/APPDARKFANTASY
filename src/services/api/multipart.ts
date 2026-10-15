import { Platform } from 'react-native';
import type { UploadAsset } from '@/features/feed/types';
export function appendAsset(form: FormData, asset: UploadAsset): void {
  if (Platform.OS === 'web' && asset.file) form.append('media', asset.file, asset.name);
  else
    form.append('media', { uri: asset.uri, name: asset.name, type: asset.type } as unknown as Blob);
}
