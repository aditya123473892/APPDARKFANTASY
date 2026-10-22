import { Image, type ImageLoadEventData, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/**
 * Shows the whole photo inside any frame: never cropped. Space the photo does not
 * fill is covered by a blurred copy of itself instead of flat bars.
 */
export function FitImage({
  uri,
  style,
  recyclingKey,
  cachePolicy = 'memory-disk',
  accessibilityLabel,
  onLoad,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  recyclingKey?: string;
  cachePolicy?: ImageProps['cachePolicy'];
  accessibilityLabel?: string;
  onLoad?: (event: ImageLoadEventData) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View
      style={[styles.frame, { backgroundColor: theme.colors.surfaceElevated }, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        blurRadius={24}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
        accessibilityIgnoresInvertColors
        style={[StyleSheet.absoluteFill, styles.backdrop]}
      />
      <Image
        source={{ uri }}
        contentFit="contain"
        transition={150}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
        accessibilityIgnoresInvertColors
        onLoad={onLoad}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  backdrop: { opacity: 0.55 },
});
