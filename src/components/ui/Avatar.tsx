import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { radius } from '@/theme';

type AvatarProps = { uri: string; size?: number; online?: boolean; ring?: boolean; label: string };

export function Avatar({ uri, size = 48, online, ring, label }: AvatarProps): React.JSX.Element {
  const { theme } = useTheme();
  const inner = ring ? size - 6 : size;
  const dot = Math.max(10, Math.round(size * 0.24));
  return (
    <View
      style={[
        { width: size, height: size },
        ring && [styles.ring, { borderColor: theme.colors.primary }],
      ]}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={160}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        accessibilityLabel={label}
        style={[
          styles.image,
          { width: inner, height: inner, backgroundColor: theme.colors.surfaceElevated },
        ]}
      />
      {online ? (
        <View
          accessibilityLabel="Online"
          style={[
            styles.online,
            {
              width: dot,
              height: dot,
              backgroundColor: theme.colors.success,
              borderColor: theme.colors.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.full },
  ring: {
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  online: { position: 'absolute', right: 0, bottom: 0, borderRadius: radius.full, borderWidth: 2 },
});
