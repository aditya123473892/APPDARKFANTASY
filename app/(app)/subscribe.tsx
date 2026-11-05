import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { spacing } from '@/theme';

export default function SubscribeScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Subscriptions" back backFallback="/home" />
      <View style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
        <Text variant="subheading">Subscriptions are not yet available</Text>
        <Text color="secondary">
          In-app purchases are not enabled yet. Premium unlocks subscriber-only posts and unlimited
          Chat with God. Contact our team if you would like premium access.
        </Text>
        <Button
          label="Contact support"
          icon="mail-outline"
          onPress={() => router.push('/legal/support' as Href)}
        />
      </View>
    </Screen>
  );
}
