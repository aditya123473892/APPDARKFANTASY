import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Button, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
export default function AccountState() {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.profileError);
  const tokenPresent = useAuthStore((s) => s.tokenPresent);
  const refresh = useAuthStore((s) => s.refreshProfile);
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
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
      <Text>{title}</Text>
      <Text>
        {error ||
          (status === 'blocked'
            ? 'Contact support through the desktop website.'
            : status === 'unverified'
              ? 'Follow the verification link in your email on the desktop website, then refresh your profile.'
              : 'Please sign in again.')}
      </Text>
      {tokenPresent && (
        <Button
          label="Refresh profile"
          onPress={() => {
            void refresh();
          }}
        />
      )}
      <Button
        label="Back to sign in"
        onPress={() => {
          void logout();
        }}
      />
    </View>
  );
}
