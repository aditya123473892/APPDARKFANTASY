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
/** One photo (JPEG/PNG/WebP), e.g. a group picture. Resolves null when cancelled. */
export async function pickImage(): Promise<UploadAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName || 'group.jpg',
    type: asset.mimeType || 'image/jpeg',
    file: asset.file,
  };
}
