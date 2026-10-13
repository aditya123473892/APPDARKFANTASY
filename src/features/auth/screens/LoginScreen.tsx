import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text, Wordmark } from '@/components/ui';
import { LoginForm } from '../components/LoginForm';
export function LoginScreen(): React.JSX.Element {
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Welcome back" back />
      <Wordmark large />
      <View style={styles.copy}>
        <Text variant="title" center>
          Sign in
        </Text>
        <Text color="muted" center>
          Pick up where you left off.
        </Text>
      </View>
      <LoginForm />
      <View style={styles.footer}>
        <Text color="muted">New here? </Text>
        <Link href="/register" asChild>
          <Text color="primary" weight="bold">
            Create account
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: 6, marginTop: 24, marginBottom: 28 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 24 },
});
