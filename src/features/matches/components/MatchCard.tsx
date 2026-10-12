import { memo } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
import { useTheme } from '@/theme/useTheme';

export const MatchCard = memo(function MatchCard({
  user,
  isNew,
  onPress,
}: {
  user: User;
  isNew: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${user.name}'s profile`}
      onPress={onPress}
      style={styles.root}
    >
      <Image source={{ uri: user.avatarUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[theme.colors.overlayTransparent, theme.colors.overlayStrong]} style={styles.overlay}>
        <Text weight="bold" style={{ color: theme.palette.white }}>
          {user.name}, {user.age}
        </Text>
        {isNew ? (
          <Text variant="caption" style={{ color: theme.palette.violet200 }}>
            New match
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  root: { flex: 1, aspectRatio: 0.78, borderRadius: 18, overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    padding: 12,
  },
});
