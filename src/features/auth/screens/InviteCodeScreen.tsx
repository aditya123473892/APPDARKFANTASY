import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { InviteCodeForm } from '../components/InviteCodeForm';
export function InviteCodeScreen(): React.JSX.Element {
  return (
    <Screen>
      <Header title="Invitation" back />
      <View style={styles.content}>
        <Text variant="title">Your invitation awaits.</Text>
        <Text color="muted">Enter the private code you received to unlock registration.</Text>
        <InviteCodeForm />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: 20, marginTop: 28 } });
