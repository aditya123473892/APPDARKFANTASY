import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';
import type { UploadAsset } from '@/features/feed/types';

async function permission(): Promise<boolean> {
  // Android's system photo picker grants access to the selected URI; no broad read permission.
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'web') return true;
  const status = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status.granted) return true;
  Alert.alert('Photo access is needed', 'Allow photo access in Settings to choose a photo.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Settings',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
  return false;
}

function selected(asset: ImagePicker.ImagePickerAsset): UploadAsset {
  // A browser picker may provide a data URI. Keep a Blob URL/file instead.
  const uri = Platform.OS === 'web' && asset.file ? URL.createObjectURL(asset.file) : asset.uri;
  if (uri.startsWith('data:')) throw new Error('This browser could not provide a photo file');
  const video = asset.type === 'video' || Boolean(asset.mimeType?.startsWith('video/'));
  return {
    uri,
    name: asset.fileName || (video ? 'video.mp4' : 'photo.jpg'),
    type: asset.mimeType || (video ? 'video/mp4' : 'image/jpeg'),
    file: asset.file,
  };
}
/** Up to five items for a post: photos plus at most one video (two minutes). */
export async function pickMedia(): Promise<UploadAsset[]> {
  if (!(await permission())) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    videoMaxDuration: 120,
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 0.85,
    base64: false,
    exif: false,
  });
  if (result.canceled) return [];
  const assets = result.assets.map(selected);
  if (assets.filter((asset) => asset.type.startsWith('video/')).length > 1)
    throw new Error('A post can include one video.');
  return assets;
}
/** One photo (JPEG/PNG/WebP), e.g. a group picture. Resolves null when cancelled. */
export async function pickImage(): Promise<UploadAsset | null> {
  if (!(await permission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: false,
    exif: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return selected(asset);
}
