import { useRouter } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';

/** A consistent, direct route to settings from the main app screens. */
export function SettingsButton(): React.JSX.Element {
  const router = useRouter();
  return (
    <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
  );
}
