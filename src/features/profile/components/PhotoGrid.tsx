import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

/** First photo is featured full width; the rest tile in two columns. */
export function PhotoGrid({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}): React.JSX.Element | null {
  const { theme } = useTheme();
  if (!photos.length) return null;
  return (
    <View style={styles.grid}>
      {photos.slice(0, 5).map((uri, index) => (
        <Image
          key={`${uri}-${index}`}
          source={{ uri }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityLabel={`${name}'s photo ${index + 1}`}
          style={[
            styles.photo,
            { backgroundColor: theme.colors.surfaceElevated },
            index === 0 && styles.large,
          ]}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { flexGrow: 1, flexBasis: '45%', aspectRatio: 0.8, borderRadius: radius.lg },
  large: { flexBasis: '100%', aspectRatio: 1.3 },
});
