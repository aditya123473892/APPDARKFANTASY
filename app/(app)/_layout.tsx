import { Stack, usePathname } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { ProtectedRoute } from '@/features/auth/components/Access';
export default function AppLayout(): React.JSX.Element {
  const { theme } = useTheme();
  const path = usePathname();
  const capability =
    path === '/groups/new'
      ? 'canCreateGroups'
      : path.startsWith('/chat')
        ? 'canSendMessages'
        : 'canUseApp';
  return (
    <ProtectedRoute capability={capability}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen
          name="create"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </ProtectedRoute>
  );
}
