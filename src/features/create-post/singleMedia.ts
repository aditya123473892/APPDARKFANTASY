import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { UploadAsset } from '@/features/feed/types';
import { createVideoThumbnail } from './videoThumbnail';

export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** Matches the backend POST_MAX_IMAGES limit (PhotoPostDto.photoIds). */
export const POST_MAX_PHOTOS = 10;
export type SelectedMedia = {
  asset: UploadAsset;
  selectionUri?: string;
  width: number;
  height: number;
  duration?: number;
  thumbnail?: string;
};
export async function prepareSingleMedia(
  picked: ImagePicker.ImagePickerAsset,
): Promise<SelectedMedia> {
  const video = picked.type === 'video' || picked.mimeType?.startsWith('video/');
  const duration = (picked.duration ?? 0) / 1000;
  if (video && (!duration || duration > VIDEO_MAX_SECONDS))
    throw new Error('Choose a video up to 60 seconds long.');
  let bytes = picked.fileSize ?? picked.file?.size;
  if (video && bytes === undefined && Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(picked.uri);
    bytes = info.exists && !info.isDirectory ? info.size : 0;
  }
  if (video && (!bytes || bytes > VIDEO_MAX_BYTES))
    throw new Error('Choose a video smaller than 50 MB.');
  const uri = Platform.OS === 'web' && picked.file ? URL.createObjectURL(picked.file) : picked.uri;
  let thumbnail: string | undefined;
  try {
    if (video) thumbnail = await createVideoThumbnail(uri);
  } catch {
    /* A play placeholder remains available if the codec cannot be thumbnailed. */
  }
  return {
    asset: {
      uri,
      name: picked.fileName ?? (video ? 'video.mp4' : 'photo.jpg'),
      type: picked.mimeType ?? (video ? 'video/mp4' : 'image/jpeg'),
      file: picked.file,
    },
    width: picked.width,
    height: picked.height,
    duration,
    thumbnail,
  };
}
export async function pickSingleMedia(camera = false): Promise<SelectedMedia | null> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error('Allow camera access in Settings to take a photo or video.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: false,
    videoMaxDuration: VIDEO_MAX_SECONDS,
    quality: 0.85,
    base64: false,
    exif: false,
  };
  const result = camera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled || !result.assets[0] ? null : prepareSingleMedia(result.assets[0]);
}

export async function pickPostMedia(camera = false): Promise<SelectedMedia[] | null> {
  if (camera) {
    const result = await pickSingleMedia(true);
    return result ? [result] : null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: POST_MAX_PHOTOS,
    videoMaxDuration: VIDEO_MAX_SECONDS,
    quality: 0.85,
    base64: false,
    exif: false,
  });
  if (result.canceled || !result.assets.length) return null;
  if (result.assets.length > POST_MAX_PHOTOS)
    throw new Error(`Choose up to ${POST_MAX_PHOTOS} photos.`);
  if (
    result.assets.length > 1 &&
    result.assets.some((asset) => asset.type === 'video' || asset.mimeType?.startsWith('video/'))
  )
    throw new Error('Choose multiple photos or one video. Videos cannot be combined with photos.');
  const prepared: SelectedMedia[] = [];
  try {
    for (const asset of result.assets) prepared.push(await prepareSingleMedia(asset));
    return prepared;
  } catch (error) {
    if (Platform.OS === 'web')
      for (const item of prepared) if (item.asset.file) URL.revokeObjectURL(item.asset.uri);
    throw error;
  }
}
