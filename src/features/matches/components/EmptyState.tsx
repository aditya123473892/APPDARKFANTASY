import { EmptyState as SharedEmptyState } from '@/components/feedback/EmptyState';
export function MatchesEmptyState(): React.JSX.Element {
  return (
    <SharedEmptyState
      icon="heart-outline"
      title="No matches yet"
      message="Keep exploring. A meaningful connection could be one swipe away."
    />
  );
}
