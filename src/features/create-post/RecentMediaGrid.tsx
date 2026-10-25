import * as MediaLibrary from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import { spacing } from '@/theme';
import { durationLabel } from '@/features/feed/presentation';
import { prepareSingleMedia, type SelectedMedia } from './singleMedia';

export function RecentMediaGrid({
  selected,
  onSelect,
  onError,
  disabled,
}: {
  selected?: string[];
  onSelect: (media: SelectedMedia) => void;
  onError: (message: string) => void;
  disabled: boolean;
}) {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const size = (Math.min(width, spacing.contentMax) - 4) / 3;
  const load = async () => {
    if (Platform.OS === 'web') return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      if (!permission.granted)
        throw new Error('Allow photo access, or use Choose media to select photos.');
      const result = await MediaLibrary.getAssetsAsync({
        first: 60,
        mediaType: ['photo', 'video'],
        sortBy: ['creationTime'],
      });
      setAssets(result.assets);
      setLoaded(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not load recent media.');
    } finally {
      setBusy(false);
    }
  };
  const select = async (asset: MediaLibrary.Asset) => {
    setBusy(true);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const result = await prepareSingleMedia({
        uri: info.localUri ?? asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.mediaType === 'video' ? 'video' : 'image',
        duration: asset.duration * 1000,
        fileName: asset.filename,
      });
      onSelect({ ...result, selectionUri: asset.uri });
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not select media.');
    } finally {
      setBusy(false);
    }
  };
  if (Platform.OS === 'web')
    return (
      <Text variant="caption" weight="regular" color="muted" style={{ padding: spacing.lg }}>
        Use Choose media to browse your device.
      </Text>
    );
  return (
    <View>
      <Pressable
        accessibilityLabel="Load recent media"
        disabled={disabled || busy}
        onPress={() => void load()}
        style={{ padding: spacing.lg, justifyContent: 'center' }}
      >
        <Text weight="semibold">
          {busy ? 'Loading…' : loaded ? 'Refresh recents' : 'Show recent media'}
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {assets.map((asset) => (
          <Pressable
            key={asset.id}
            disabled={disabled || busy}
            accessibilityLabel={`Select ${asset.mediaType} ${asset.filename}`}
            accessibilityState={{ selected: selected?.includes(asset.uri) }}
            onPress={() => void select(asset)}
            style={{
              width: size,
              height: size,
              backgroundColor: theme.colors.surfaceMuted,
              borderWidth: selected?.includes(asset.uri) ? 2 : 0,
              borderColor: theme.colors.primary,
            }}
          >
            {asset.mediaType === 'photo' ? (
              <Image
                source={{ uri: asset.uri }}
                contentFit="cover"
                cachePolicy="memory-disk"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="play" size={28} color={theme.colors.text} />
                <Text variant="caption" weight="regular" color="muted">
                  {durationLabel(asset.duration)}
                </Text>
              </View>
            )}
            {selected?.includes(asset.uri) ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 12 }}>
                  {selected.indexOf(asset.uri) + 1}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {loaded && !assets.length ? (
        <Text color="muted" style={{ padding: spacing.lg }}>
          No recent media. Choose a file or open the camera.
        </Text>
      ) : null}
    </View>
  );
}
