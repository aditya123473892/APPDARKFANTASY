import * as ImagePicker from 'expo-image-picker';
import type { UploadAsset } from '@/features/feed/types';
export async function pickMedia(): Promise<UploadAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.fileName || (asset.type === 'video' ? 'video.mp4' : 'photo.jpg'),
    type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    file: asset.file,
  }));
}
