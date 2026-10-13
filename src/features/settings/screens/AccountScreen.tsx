import { useMutation } from '@tanstack/react-query';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Input, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { authService } from '@/features/auth/services';
import { useAuthStore } from '@/features/auth/store/authStore';
import { spacing } from '@/theme';
import { SUPPORT_EMAIL } from '@/utils/constants';
import { SettingsGroup, SettingsRow } from '../components/SettingsRow';

export function AccountScreen(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const reset = useMutation({
    mutationFn: (email: string) => authService.requestPasswordReset(email),
    onSuccess: (_data, email) =>
      toast.success(`If ${email} is registered, a reset link is on its way.`),
    onError: () => toast.error("Couldn't send a reset link. Please try again."),
  });

  const requestDeletion = (): void =>
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, connections and messages. Our support team will confirm the request with you by email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          style: 'destructive',
          onPress: () => {
            const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Account deletion request')}`;
            Linking.openURL(url).catch(() =>
              toast.error(`No email app found. Contact ${SUPPORT_EMAIL}.`),
            );
          },
        },
      ],
    );

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Account" back backFallback="/settings" />
      <View style={styles.content}>
        <View style={styles.field}>
          <Input label="Email" value={user?.email ?? ''} editable={false} icon="mail-outline" />
          <Text variant="caption" color="muted">
            Contact support to change the email on your account.
          </Text>
        </View>
        <SettingsGroup title="Security">
          <SettingsRow
            icon="key-outline"
            title="Change password"
            subtitle="We'll email you a secure reset link"
            loading={reset.isPending}
            onPress={() => user?.email && reset.mutate(user.email)}
            last
          />
        </SettingsGroup>
        <SettingsGroup title="Danger zone">
          <SettingsRow
            icon="trash-outline"
            title="Delete account"
            subtitle="Request permanent deletion of your data"
            danger
            onPress={requestDeletion}
            last
          />
        </SettingsGroup>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingVertical: spacing.lg },
  field: { gap: spacing.sm },
});
