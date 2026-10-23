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
  locked = false,
  onSize,
}: {
  uri: string;
  mimetype?: string;
  width: number;
  height: number;
  privateMedia?: boolean;
  /** Premium media the viewer cannot open. */
  locked?: boolean;
  /** Reports the image's natural pixel size once loaded. */
  onSize?: (width: number, height: number) => void;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const { theme } = useTheme();
  if (failedUri === uri || !uri)
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
        <Text color="muted">{locked ? 'Subscribers only' : 'Media unavailable'}</Text>
      </View>
    );
  if (mimetype?.startsWith('video/')) return <Video uri={uri} width={width} height={height} />;
  return (
    <Image
      source={{ uri }}
      onError={() => setFailedUri(uri)}
      onLoad={
        onSize
          ? ({ source }) => {
              if (source.width > 0 && source.height > 0) onSize(source.width, source.height);
            }
          : undefined
      }
      recyclingKey={uri}
      contentFit="contain"
      cachePolicy={privateMedia ? 'none' : 'memory'}
      style={{ width, height, backgroundColor: theme.colors.surfaceElevated }}
    />
  );
}
