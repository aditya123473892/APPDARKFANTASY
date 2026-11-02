import { Button } from '@/components/ui';
import { useFollowUser } from '../hooks/useRequests';
import { followLabel } from '../relationship';

import { dialog } from '@/components/ui/dialogStore';
/** Shared by profile, Discover and relationship lists. Pending follows remain actionable. */
export function FollowButton({ userId }: { userId: string }) {
  const follow = useFollowUser(userId);
  const action = () => {
    if (follow.error) return follow.retry();
    if (follow.state.status === 'none') return follow.follow();
    const label = follow.state.status === 'following' ? 'Unfollow' : 'Cancel Request';
    dialog.alert(label, undefined, [
      { text: 'Keep', style: 'cancel' },
      { text: label, style: 'destructive', onPress: follow.remove },
    ]);
  };
  return (
    <Button
      label={follow.error ? 'Retry follow status' : followLabel(follow.state.status)}
      variant="secondary"
      size="sm"
      fullWidth={false}
      loading={follow.pending || follow.loading}
      disabled={follow.pending || follow.loading}
      onPress={action}
    />
  );
}
