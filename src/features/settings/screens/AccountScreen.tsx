import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Input, Text } from '@/components/ui';
import { currentUser } from '@/mocks/users';
export function AccountScreen(): React.JSX.Element {
  return (
    <Screen scroll>
      <Header title="Account" back />
      <View style={styles.form}>
        <Text variant="heading">Contact details</Text>
        <Input label="Email" value={currentUser.email} editable={false} />
        <Text variant="caption" color="muted">
          Email changes will be available when the backend is connected.
        </Text>
        <Button label="Change password" variant="secondary" onPress={() => undefined} />
        <Text variant="heading">Account actions</Text>
        <Button label="Pause account" variant="secondary" onPress={() => undefined} />
        <Button label="Delete account" variant="danger" onPress={() => undefined} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ form: { gap: 16, paddingVertical: 20 } });
