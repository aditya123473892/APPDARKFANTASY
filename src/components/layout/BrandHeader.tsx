import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Avatar, IconButton } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { spacing } from '@/theme';
import { Header } from './Header';
import { SettingsButton } from './SettingsButton';

export function BrandHeader(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  return (
    <View style={styles.root}>
      <Header
        title="Dark"
        action={
          <View style={styles.actions}>
            <IconButton
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Avatar uri={user?.avatarUri ?? ''} label={user?.name ?? 'Your profile'} size={32} />
            </Pressable>
            <SettingsButton />
          </View>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.screen },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatar: {
    minWidth: spacing.touch,
    minHeight: spacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
