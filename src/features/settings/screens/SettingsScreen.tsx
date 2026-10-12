import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Divider, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/theme/useTheme';
import { SettingsRow } from '../components/SettingsRow';
export function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { mode, setMode } = useTheme();
  const [notifications, setNotifications] = useState(true);
  return (
    <Screen scroll>
      <Header title="Settings" back />
      <Text variant="label" color="muted">
        ACCOUNT
      </Text>
      <SettingsRow
        icon="person-outline"
        title="Account"
        subtitle="Email, password, and profile"
        onPress={() => router.push('/settings/account')}
      />
      <SettingsRow
        icon="shield-checkmark-outline"
        title="Privacy"
        subtitle="Visibility and safety controls"
        onPress={() => router.push('/settings/privacy')}
      />
      <Divider />
      <Text variant="label" color="muted">
        PREFERENCES
      </Text>
      <SettingsRow
        icon="notifications-outline"
        title="Notifications"
        subtitle="Matches and new messages"
        value={notifications}
        onValueChange={setNotifications}
      />
      <SettingsRow
        icon="moon-outline"
        title="Dark appearance"
        subtitle={mode === 'system' ? 'Following your device' : mode === 'dark' ? 'On' : 'Off'}
        value={mode === 'dark'}
        onValueChange={(value) => setMode(value ? 'dark' : 'light')}
      />
      <Divider />
      <SettingsRow
        icon="log-out-outline"
        title="Log out"
        subtitle="Securely clear this session"
        danger
        onPress={() => void logout()}
      />
    </Screen>
  );
}
