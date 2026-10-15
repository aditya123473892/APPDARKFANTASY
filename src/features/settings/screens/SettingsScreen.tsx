import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { spacing } from '@/theme';
import { APP_NAME } from '@/utils/constants';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';

export function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [loggingOut, setLoggingOut] = useState(false);

  const confirmLogout = (): void =>
    Alert.alert('Log out?', 'You will need to sign in again to see your messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLoggingOut(true);
          logout().catch(() => {
            setLoggingOut(false);
            toast.error("Couldn't log out. Please try again.");
          });
        },
      },
    ]);

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Settings" back backFallback="/profile" />
      <View style={styles.content}>
        <SettingsGroup title="Account">
          <SettingsRow
            icon="person-outline"
            title="Account"
            subtitle={user?.email ?? 'Email and password'}
            onPress={() => router.push('/settings/account')}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy"
            subtitle="Distance, active status, read receipts"
            onPress={() => router.push('/settings/privacy')}
            last
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            icon="log-out-outline"
            title="Log out"
            subtitle="Securely clear this session from this device"
            danger
            loading={loggingOut}
            onPress={confirmLogout}
            last
          />
        </SettingsGroup>

        <Text variant="caption" color="muted" center>
          {APP_NAME} · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: spacing.xl, paddingVertical: spacing.lg } });
