import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text, Wordmark } from '@/components/ui';
import { LoginForm } from '../components/LoginForm';
import { SocialButtons } from '../components/SocialButtons';
import { spacing } from '@/theme';
export function LoginScreen(): React.JSX.Element {
  useScreenshotProtection('login');
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Welcome back" back />
      <Wordmark large />
      <View style={styles.copy}>
        <Text variant="display" center>
          A little mystery.{'\n'}A real connection.
        </Text>
        <Text color="muted" center>
          Your next chapter starts here.
        </Text>
      </View>
      <LoginForm />
      <View style={styles.social}>
        <Text variant="caption" color="muted" center>
          OR CONTINUE WITH
        </Text>
        <SocialButtons />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: spacing.sm, marginTop: spacing.xxxl, marginBottom: spacing.xxxl },
  social: { gap: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 24 },
});
