import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthLink, AuthPrompt, AuthScaffold } from '../components/AuthScaffold';
import { PhoneOtpFlow } from '../components/PhoneOtpFlow';
import { phoneAuth } from '../services/phoneAuth';
import { completePhoneSignIn } from '../phoneSignIn';
import { spacing } from '@/theme';

/** Mobile sign-in is phone number + SMS code only (enforced by the backend too). */
export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  useScreenshotProtection('login');
  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Enter your mobile number and we'll text you a code."
      footer={
        <AuthPrompt
          question="New here?"
          action="Create an account"
          onPress={() => router.replace('/register')}
        />
      }
    >
      <View style={styles.form}>
        <PhoneOtpFlow
          sendCode={phoneAuth.sendLoginCode}
          verifyCode={(phone, code) =>
            completePhoneSignIn(() => phoneAuth.verifyLoginCode(phone, code))
          }
          sendLabel="Continue"
          verifyLabel="Sign in"
          autoFocus={false}
        />
        <AuthLink label="Forgot password?" onPress={() => router.push('/forgot-password')} />
      </View>
    </AuthScaffold>
  );
}
const styles = StyleSheet.create({ form: { gap: spacing.md } });
