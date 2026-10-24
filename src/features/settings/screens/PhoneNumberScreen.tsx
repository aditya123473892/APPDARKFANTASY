import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Input, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { PhoneOtpFlow } from '@/features/auth/components/PhoneOtpFlow';
import { formatPhone } from '@/features/auth/phone';
import { phoneAuth } from '@/features/auth/services/phoneAuth';
import { useAuthStore } from '@/features/auth/store/authStore';
import { spacing } from '@/theme';

/** Changing the sign-in number always needs a fresh code sent to the new number. */
export function PhoneNumberScreen(): React.JSX.Element {
  const router = useRouter();
  const current = useAuthStore((state) => state.currentUser?.phoneE164);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Phone number" back backFallback="/settings/account" />
      <View style={styles.content}>
        <Input
          label="Current sign-in number"
          value={current ? formatPhone(current) : 'Not set'}
          editable={false}
          icon="call-outline"
        />
        <Text variant="subheading">Change number</Text>
        <Text color="muted">
          We'll text a code to the new number. Your current number keeps working until the new one
          is verified.
        </Text>
        <PhoneOtpFlow
          sendCode={(phone) => phoneAuth.sendLinkCode(phone)}
          verifyCode={async (phone, code) => {
            await phoneAuth.verifyLinkCode(phone, code);
            await useAuthStore.getState().refreshProfile();
            toast.success(`Sign-in number changed to ${formatPhone(phone)}.`);
            router.back();
          }}
          sendLabel="Send code to new number"
          verifyLabel="Verify new number"
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingVertical: spacing.lg } });
