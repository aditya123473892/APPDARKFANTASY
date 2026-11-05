import { Stack } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

/** Legal and support pages; reachable signed in or out, and from the 18+ check. */
export default function LegalLayout(): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
