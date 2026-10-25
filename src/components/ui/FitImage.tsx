import { Image, type ImageLoadEventData, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { useState } from 'react';
import { imageAspectRatio } from '@/utils/imageLayout';

/**
 * The frame follows the decoded photo, so the complete image fills its own bounds.
 * No blurred duplicates, fixed-ratio crop, or letterbox filler.
 */
export function FitImage({
  uri,
  style,
  recyclingKey,
  cachePolicy = 'memory-disk',
  accessibilityLabel,
  onLoad,
  imageWidth,
  imageHeight,
  onError,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  recyclingKey?: string;
  cachePolicy?: ImageProps['cachePolicy'];
  accessibilityLabel?: string;
  onLoad?: (event: ImageLoadEventData) => void;
  imageWidth?: number;
  imageHeight?: number;
  onError?: ImageProps['onError'];
}): React.JSX.Element {
  const { theme } = useTheme();
  const [loaded, setLoaded] = useState<{ uri: string; ratio: number }>();
  const ratio =
    (loaded?.uri === uri ? loaded.ratio : undefined) ??
    imageAspectRatio(imageWidth, imageHeight) ??
    1;
  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: theme.colors.surfaceElevated },
        style,
        { height: undefined, aspectRatio: ratio },
      ]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri }}
        contentFit="contain"
        transition={150}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
        accessibilityIgnoresInvertColors
        onLoad={(event) => {
          const next = imageAspectRatio(event.source.width, event.source.height);
          if (next)
            setLoaded((current) =>
              current?.uri === uri && current.ratio === next ? current : { uri, ratio: next },
            );
          onLoad?.(event);
        }}
        onError={onError}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
});
