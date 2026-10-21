import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';

export default function SubscribeScreen(): React.JSX.Element {
  return (
    <Screen>
      <Header title="Subscriptions" back backFallback="/home" />
      <Text variant="subheading">Subscriptions are not yet available</Text>
      <Text>Purchases are not enabled yet. Premium images remain locked until an active subscription is verified by the server.</Text>
    </Screen>
  );
}
