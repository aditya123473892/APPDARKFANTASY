import { useState } from 'react';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/useTheme';
function Video({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer({ uri, useCaching: false });
  return (
    <VideoView player={player} nativeControls contentFit="contain" style={{ width, height }} />
  );
}
export function RemoteMedia({
  uri,
  mimetype,
  width,
  height,
  privateMedia = false,
}: {
  uri: string;
  mimetype?: string;
  width: number;
  height: number;
  privateMedia?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();
  if (failed || !uri)
    return (
      <View
        style={{
          width,
          height,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceElevated,
        }}
      >
        <Text color="muted">Media unavailable</Text>
      </View>
    );
  if (mimetype?.startsWith('video/')) return <Video uri={uri} width={width} height={height} />;
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      contentFit="contain"
      cachePolicy={privateMedia ? 'none' : 'memory'}
      style={{ width, height, backgroundColor: theme.colors.surfaceElevated }}
    />
  );
}
