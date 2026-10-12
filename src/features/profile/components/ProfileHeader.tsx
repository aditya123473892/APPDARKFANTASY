import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
import { useTheme } from '@/theme/useTheme';
export function ProfileHeader({
  user,
  mine = false,
  onSettings,
  onMessage,
}: {
  user: User;
  mine?: boolean;
  onSettings?: () => void;
  onMessage?: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.photoWrap}>
        <Image
          source={{ uri: user.avatarUri }}
          contentFit="cover"
          accessibilityLabel={`${user.name}'s profile photo`}
          style={[styles.photo, { borderColor: theme.colors.primary }]}
        />
        <View
          style={[
            styles.status,
            { backgroundColor: theme.colors.success, borderColor: theme.colors.background },
          ]}
        />
      </View>
      <View style={styles.nameRow}>
        <Text variant="title">
          {user.name}, {user.age}
        </Text>
        <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
      </View>
      <Text color="muted" center>
        {user.bio}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mine ? 'Open settings' : `Message ${user.name}`}
        onPress={mine ? onSettings : onMessage}
        style={[styles.action, { backgroundColor: theme.colors.primarySoft }]}
      >
        <Ionicons
          name={mine ? 'settings-outline' : 'chatbubble-outline'}
          size={20}
          color={theme.colors.primary}
        />
        <Text color="primary" weight="bold">
          {mine ? 'Settings' : 'Message'}
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 10 },
  photoWrap: { position: 'relative' },
  photo: { width: 118, height: 118, borderRadius: 999, borderWidth: 3 },
  status: {
    position: 'absolute',
    right: 6,
    bottom: 7,
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 3,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: {
    minHeight: 44,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
});
