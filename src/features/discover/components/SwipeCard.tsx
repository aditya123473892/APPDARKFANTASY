import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from '@/components/ui';
import type { ProfileView } from '@/features/profile/types';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance } from '@/utils/formatters';

export function SwipeCard({
  profile,
  showDistance,
  showPresence,
  onPass,
}: {
  profile: ProfileView;
  showDistance: boolean;
  showPresence: boolean;
  /** Browse the next card without changing the connection state. */
  onPass?: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(0);
  }, [profile.id, x]);
  const finishPass = () => {
    x.set(0);
    onPass?.();
  };
  const pan = Gesture.Pan()
    .enabled(Boolean(onPass))
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      x.set(Math.min(32, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -110 || event.velocityX < -900) {
        x.set(
          withTiming(-width, { duration: 220 }, (finished) => {
            if (finished) scheduleOnRN(finishPass);
          }),
        );
      } else x.set(withSpring(0, { damping: 20, stiffness: 220 }));
    });
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: `${(x.value / width) * 6}deg` }],
  }));
  const distance = showDistance ? formatDistance(profile.distanceKm) : null;
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          motion,
          { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
        ]}
      >
        <Image
          source={{ uri: profile.avatarUri }}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          recyclingKey={profile.id}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`${profile.name}'s profile photo`}
        />
        <LinearGradient
          colors={[theme.colors.overlayTransparent, theme.colors.overlayStrong]}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          {profile.relationship.status === 'incoming' ? (
            <View style={[styles.tag, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="heart" size={12} color={theme.colors.onPrimary} />
              <Text variant="caption" weight="bold" color="inverse">
                Wants to connect with you
              </Text>
            </View>
          ) : null}
          <View style={styles.nameRow}>
            <Text
              variant="display"
              numberOfLines={1}
              style={[styles.name, { color: theme.colors.onImage }]}
            >
              {profile.name}
              {profile.age > 0 ? `, ${profile.age}` : ''}
            </Text>
            {showPresence && profile.presence?.online ? (
              <View
                accessibilityLabel="Online now"
                style={[styles.online, { backgroundColor: theme.colors.success }]}
              />
            ) : null}
          </View>
          <Text variant="label" numberOfLines={1} style={{ color: theme.colors.imageGold }}>
            {[profile.occupation, distance ?? profile.location].filter(Boolean).join(' · ')}
          </Text>
          <Text numberOfLines={3} style={{ color: theme.colors.onImage }}>
            {profile.bio}
          </Text>
          <View style={styles.chips}>
            {profile.interests.slice(0, 3).map((interest) => (
              <View
                key={interest}
                style={[
                  styles.interest,
                  { backgroundColor: theme.colors.imageTag, borderColor: theme.colors.imageMuted },
                ]}
              >
                <Text variant="caption" style={{ color: theme.colors.onImage }}>
                  {interest}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  content: { padding: spacing.xl, gap: spacing.sm },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  online: { width: 10, height: 10, borderRadius: 999 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  interest: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
