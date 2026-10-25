import * as VideoThumbnails from 'expo-video-thumbnails';
export async function createVideoThumbnail(uri: string): Promise<string> {
  return (await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.7 })).uri;
}
