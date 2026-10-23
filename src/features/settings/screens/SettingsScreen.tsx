import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { spacing } from '@/theme';
import { APP_NAME } from '@/utils/constants';
import { useTheme } from '@/theme/useTheme';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';

export function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [loggingOut, setLoggingOut] = useState(false);
  const canModerate = useCan('canModerate');
  const canAdmin = useCan('canViewAdminScreens');

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
        <SettingsGroup title="Appearance">
          <SettingsRow
            icon="moon-outline"
            title="Dark"
            subtitle="Velvet Noir"
            value={mode === 'dark'}
            onValueChange={() => setMode('dark')}
          />
          <SettingsRow
            icon="sunny-outline"
            title="Light"
            value={mode === 'light'}
            onValueChange={() => setMode('light')}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            title="Use device appearance"
            value={mode === 'system'}
            onValueChange={() => setMode('system')}
            last
          />
        </SettingsGroup>
        <SettingsGroup title="Account">
          <SettingsRow
            icon="sparkles-outline"
            title="Chat with God"
            subtitle="Ask the AI guide anything about the app"
            onPress={() => router.push('/god-chat' as Href)}
          />
          <SettingsRow icon="flag-outline" title="My reports" onPress={() => router.push('/settings/my-reports' as Href)} />
          <SettingsRow
            icon="ban-outline"
            title="Blocked users"
            onPress={() => router.push('/settings/blocked-users' as Href)}
          />
          <SettingsRow
            icon="lock-closed-outline"
            title="Photo Vault"
            subtitle="Private photos and videos, PIN or biometric lock"
            onPress={() => router.push('/vault' as Href)}
          />
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

        {(canModerate || canAdmin) && (
          <SettingsGroup title="Staff">
            {canAdmin && (
              <SettingsRow
                icon="images-outline"
                title="Media review"
                subtitle="All uploaded photos and videos: flag or make subscriber-only"
                onPress={() => router.push('/admin/media' as Href)}
                last={!canModerate}
              />
            )}
            {canModerate && (
              <SettingsRow
                icon="shield-outline"
                title="Moderation"
                subtitle="Reports and blocks"
                onPress={() => router.push('/moderation' as Href)}
                last
              />
            )}
          </SettingsGroup>
        )}

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
