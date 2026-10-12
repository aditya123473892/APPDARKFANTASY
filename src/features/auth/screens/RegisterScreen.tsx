import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text, Wordmark } from '@/components/ui';
import { RegisterForm } from '../components/RegisterForm';
export function RegisterScreen(): React.JSX.Element {
  return (
    <Screen scroll>
      <Header title="Create account" back />
<Wordmark large />
      <View style={styles.copy}>
<Text variant="title" center>Meet your next favorite person.</Text>
<Text color="muted" center>A few details and you're in.</Text>
      </View>
      <RegisterForm />
      <View style={styles.footer}>
        <Text color="muted">Already have an account? </Text>
        <Link href="/login" asChild>
          <Text color="primary" weight="bold">
            Sign in
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  copy: { gap: 6, marginTop: 18, marginBottom: 24 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
});
