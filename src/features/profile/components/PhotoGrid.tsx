import { StyleSheet, View } from 'react-native';
import { FitImage } from '@/components/ui/FitImage';
import { radius, spacing } from '@/theme';

/** First photo is featured full width; the rest tile in two columns. Photos are never cropped. */
export function PhotoGrid({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}): React.JSX.Element | null {
  if (!photos.length) return null;
  return (
    <View style={styles.grid}>
      {photos.slice(0, 5).map((uri, index) => (
        <FitImage
          key={`${uri}-${index}`}
          uri={uri}
          accessibilityLabel={`${name}'s photo ${index + 1}`}
          style={[styles.photo, index === 0 && styles.large]}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { flexGrow: 1, flexBasis: '45%', aspectRatio: 0.8, borderRadius: radius.lg },
  // Profile photos are square, so the featured slot is square: shown whole, no bars.
  large: { flexBasis: '100%', aspectRatio: 1 },
});
