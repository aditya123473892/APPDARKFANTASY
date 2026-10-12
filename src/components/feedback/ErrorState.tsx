import { EmptyState } from './EmptyState';
export function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Something went wrong"
      message="We couldn't load this right now. Please try again."
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}
