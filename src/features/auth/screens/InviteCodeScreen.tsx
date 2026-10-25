import { spacing } from '@/theme';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { InviteCodeForm } from '../components/InviteCodeForm';
export function InviteCodeScreen(): React.JSX.Element {
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Invitation" back />
      <View style={styles.content}>
        <Text variant="title">Your invitation awaits.</Text>
        <Text color="muted">Enter the private code you received to unlock registration.</Text>
        <InviteCodeForm />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: spacing.lg, marginTop: spacing.xl } });
