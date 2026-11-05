import { useRouter } from 'expo-router';
import { IconButton } from '@/components/ui';
import { useUnreadNotificationCount } from '../hooks/useActivity';

/** Header bell that shows a dot while there are unread notifications. */
export function NotificationBell(): React.JSX.Element {
  const router = useRouter();
  const unread = useUnreadNotificationCount();
  return (
    <IconButton
      icon={unread > 0 ? 'notifications' : 'notifications-outline'}
      label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      dot={unread > 0}
      onPress={() => router.push('/notifications')}
    />
  );
}
