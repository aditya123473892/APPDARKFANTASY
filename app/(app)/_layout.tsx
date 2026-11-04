import { Stack, usePathname } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { ProtectedRoute } from '@/features/auth/components/Access';
import { useEntitlementSync } from '@/features/subscriptions/entitlements';
import { useSavedPostsSync } from '@/features/feed/hooks/useFeed';
export default function AppLayout(): React.JSX.Element {
  useEntitlementSync();
  // Bookmarks show on every post, so they load once per session, not only on Saved.
  useSavedPostsSync();
  const { theme } = useTheme();
  const path = usePathname();
  const capability = path.startsWith('/admin')
    ? 'canViewAdminScreens'
    : path.startsWith('/moderation')
      ? 'canModerate'
      : path === '/groups/new'
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
          // Screens covered by another one stop re-rendering until they are back on top.
          freezeOnBlur: true,
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
