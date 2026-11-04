import { spacing } from '@/theme';
import { View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Button, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
export default function AccountState() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.profileError);
  const tokenPresent = useAuthStore((s) => s.tokenPresent);
  const refresh = useAuthStore((s) => s.refreshProfile);
  const hydrate = useAuthStore((s) => s.hydrate);
  // After a failed launch there is no session yet: retry the whole sign-in from storage.
  const signedIn = useAuthStore((s) => Boolean(s.session));
  const logout = useAuthStore((s) => s.logout);
  if (status === 'authenticated') return <Redirect href="/home" />;
  const title = error
    ? 'Profile unavailable'
    : status === 'blocked'
      ? 'Account blocked'
      : status === 'unverified'
        ? 'Verify your email'
        : 'Session expired';
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Text>{title}</Text>
      {status !== 'blocked' && (
        <Button label="Open offline Photo Vault" onPress={() => router.push('/vault' as Href)} />
      )}
      <Text>
        {error ||
          (status === 'blocked'
            ? 'Contact support through the desktop website.'
            : status === 'unverified'
              ? 'Open the verification link in your email, then return and sign in. You can resend the link from the sign-in screen using your email and password.'
              : 'Please sign in again.')}
      </Text>
      {tokenPresent && (
        <Button
          label="Refresh profile"
          onPress={() => {
            void (signedIn ? refresh() : hydrate());
          }}
        />
      )}
      <Button
        label="Back to sign in"
        onPress={() => {
          void logout().catch(() => undefined);
        }}
      />
    </View>
  );
}
