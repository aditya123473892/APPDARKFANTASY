import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PostMedia } from '@/features/feed/types';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

export function PostImage({ image, locked, width, height, onSize }: {
  image: PostMedia; locked: boolean; width: number; height: number;
  onSize?: (width: number, height: number) => void;
}): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const cacheKey = `${image.id}:${locked ? 'locked' : 'unlocked'}`;
  return (
    <View style={{ width, height, backgroundColor: theme.colors.surfaceElevated }}>
      <Image source={image.uri ? { uri: image.uri, cacheKey } : undefined}
        placeholder={image.blurhash ? { blurhash: image.blurhash } : undefined}
        recyclingKey={cacheKey} contentFit="contain" cachePolicy="memory"
        accessibilityLabel={locked ? 'Locked premium image preview' : 'Post image'}
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) onSize?.(source.width, source.height);
        }}
        style={StyleSheet.absoluteFill} />
      {locked ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Subscribe to view"
          onPress={() => router.push('/subscribe' as never)}
          style={[StyleSheet.absoluteFill, styles.lock]}>
          <Ionicons name="lock-closed" size={28} color="white" />
          <Text style={styles.label}>Subscribe to view</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.22)' },
  label: { color: 'white', fontWeight: '600' },
});
