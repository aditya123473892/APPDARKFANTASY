import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Modal, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCan } from '@/features/auth/hooks/useCurrentUser';
import { spacing } from '@/theme';
import { APP_NAME } from '@/utils/constants';
import { useTheme } from '@/theme/useTheme';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';
import { EditProfileForm } from '@/features/profile/components/EditProfileForm';

const morePages = [
  { icon: 'compass-outline', title: 'Discover', href: '/discover' },
  { icon: 'people-outline', title: 'Matches', href: '/matches' },
  { icon: 'heart-outline', title: 'Likes', href: '/likes' },
  { icon: 'bookmark-outline', title: 'Saved', href: '/saved' },
  { icon: 'notifications-outline', title: 'Notifications', href: '/notifications' },
  { icon: 'pulse-outline', title: 'Activity & follow requests', href: '/activity' },
  { icon: 'sparkles-outline', title: 'Chat with God', href: '/god-chat' },
  { icon: 'help-circle-outline', title: 'Help', href: '/help' },
] as const;

export function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const canModerate = useCan('canModerate');
  const canAdmin = useCan('canViewAdminScreens');
  const canMessage = useCan('canSendMessages');
  const canCreateGroups = useCan('canCreateGroups');

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
        <SettingsGroup title="Profile">
          <SettingsRow
            icon="person-circle-outline"
            title="My profile"
            onPress={() => router.push('/profile')}
          />
          {user && (
            <SettingsRow
              icon="create-outline"
              title="Edit profile"
              onPress={() => setEditingProfile(true)}
            />
          )}
          <SettingsRow
            icon="images-outline"
            title="Photos"
            onPress={() => router.push('/profile/photos')}
          />
          <SettingsRow
            icon="diamond-outline"
            title="Subscriptions"
            onPress={() => router.push('/subscribe')}
            last
          />
        </SettingsGroup>

        <SettingsGroup title="More pages">
          {morePages.map((page, index) => (
            <SettingsRow
              key={page.href}
              icon={page.icon}
              title={page.title}
              onPress={() => router.push(page.href)}
              last={index === morePages.length - 1}
            />
          ))}
        </SettingsGroup>

        <SettingsGroup title="Create & connect">
          <SettingsRow
            icon="add-circle-outline"
            title="Create a post"
            onPress={() => router.push('/create')}
            last={!canMessage && !canCreateGroups && !canAdmin}
          />
          {canMessage && (
            <SettingsRow
              icon="chatbubble-outline"
              title="New message"
              onPress={() => router.push('/chat/new')}
              last={!canCreateGroups && !canAdmin}
            />
          )}
          {canCreateGroups && (
            <SettingsRow
              icon="people-circle-outline"
              title="Create a group"
              onPress={() => router.push('/groups/new')}
              last={!canAdmin}
            />
          )}
          {canAdmin && (
            <SettingsRow
              icon="calendar-outline"
              title="Create an event"
              onPress={() => router.push('/events/new')}
              last
            />
          )}
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          {__DEV__ ? <SettingsRow icon="color-palette-outline" title="Social UI preview" onPress={() => router.push('/ui-preview' as Href)} /> : null}
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
            icon="flag-outline"
            title="My reports"
            onPress={() => router.push('/settings/my-reports' as Href)}
          />
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
            icon="key-outline"
            title="Vault settings"
            onPress={() => router.push('/vault/settings')}
          />
          <SettingsRow
            icon="person-outline"
            title="Account"
            subtitle={user?.email ?? 'Email and password'}
            onPress={() => router.push('/settings/account')}
          />
          <SettingsRow
            icon="call-outline"
            title="Phone number"
            onPress={() => router.push('/settings/phone')}
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
      {user && (
        <Modal
          visible={editingProfile}
          title="Edit profile"
          onClose={() => setEditingProfile(false)}
        >
          <EditProfileForm user={user} onDone={() => setEditingProfile(false)} />
        </Modal>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: spacing.xl, paddingVertical: spacing.lg } });
