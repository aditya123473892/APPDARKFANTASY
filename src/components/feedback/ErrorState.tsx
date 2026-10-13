import { EmptyState } from '@/components/ui/EmptyState';
export function ErrorState({
  onRetry,
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
  compact,
}: {
  onRetry: () => void;
  title?: string;
  message?: string;
  compact?: boolean;
}): React.JSX.Element {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      tone="danger"
      title={title}
      message={message}
      actionLabel="Try again"
      onAction={onRetry}
      compact={compact}
    />
  );
}
