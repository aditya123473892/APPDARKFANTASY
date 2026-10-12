import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
export function PhotoGrid({ photos }: { photos: string[] }): React.JSX.Element {
  return (
    <View style={styles.grid}>
      {photos.slice(0, 4).map((uri, index) => (
        <Image
          key={`${uri}-${index}`}
          source={{ uri }}
          contentFit="cover"
          transition={120}
          accessibilityLabel={`Profile photo ${index + 1}`}
          style={[styles.photo, index === 0 && styles.large]}
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '48.7%', aspectRatio: 1, borderRadius: 16 },
  large: { width: '100%', aspectRatio: 1.55 },
});
