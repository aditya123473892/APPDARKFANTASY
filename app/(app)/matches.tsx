import { router } from 'expo-router';
import { Header, Screen } from '@/components/layout';
import { EmptyState } from '@/components/ui';

export default function MatchesScreen() {
  return (
    <Screen>
      <Header title="Matches" back backFallback="/profile" />
      <EmptyState
        icon="people-outline"
        title="Your connections"
        message="Browse people or continue a conversation from Messages."
        actionLabel="Discover people"
        onAction={openDiscover}
      />
    </Screen>
  );
}
const openDiscover = () => router.push('/discover');
