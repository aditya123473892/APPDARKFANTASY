import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { accentGradient, radius } from '@/theme';

type AvatarProps = { uri: string; size?: number; online?: boolean; ring?: boolean; label: string };

export function Avatar({ uri, size = 48, online, ring, label }: AvatarProps): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      {ring ? <LinearGradient colors={accentGradient} style={[styles.ring, { width: size, height: size }]}><Image
        source={{ uri }} contentFit="cover" transition={160} accessibilityLabel={label}
        style={[styles.ringImage, { width: size - 4, height: size - 4, borderColor: theme.colors.background }]}
      /></LinearGradient> : <Image
        source={{ uri }}
        contentFit="cover"
        transition={160}
        accessibilityLabel={label}
        style={[styles.image, { width: size, height: size, borderColor: theme.colors.surface }]}
      />}
      {online ? (
        <View
          accessibilityLabel="Online"
          style={[
            styles.online,
            { backgroundColor: theme.colors.success, borderColor: theme.colors.surface },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.full, borderWidth: 2 },
  ring: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  ringImage: { borderRadius: radius.full, borderWidth: 2 },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: radius.full,
    borderWidth: 2,
  },
});
