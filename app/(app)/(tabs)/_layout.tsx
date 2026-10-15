import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadMessageCount } from '@/features/chat/hooks/useChat';
import { useIncomingRequestCount } from '@/features/requests/hooks/useRequests';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useRoles } from '@/features/auth/hooks/useCurrentUser';
import { hasCapability, type Capability } from '@/features/auth/permissions';
const tabCapabilities: Record<string, Capability> = {
  home: 'canUseApp',
  discover: 'canUseApp',
  chats: 'canSendMessages',
  activity: 'canUseApp',
  profile: 'canUseApp',
};

type IconName = keyof typeof Ionicons.glyphMap;
const icons: Record<string, [IconName, IconName]> = {
  home: ['home', 'home-outline'],
  discover: ['compass', 'compass-outline'],
  chats: ['chatbubbles', 'chatbubbles-outline'],
  activity: ['notifications', 'notifications-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};

export default function TabsLayout(): React.JSX.Element {
  const roles = useRoles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const unreadMessages = useUnreadMessageCount();
  const incomingRequests = useIncomingRequestCount();
  const activityBadge = incomingRequests;
  const badge = (count: number) => (count > 0 ? (count > 99 ? '99+' : count) : undefined);

  return (
    <Tabs
      backBehavior="history"
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
      }}
      screenOptions={({ route }) => {
        const pair = icons[route.name] ?? icons.home!;
        return {
          href: hasCapability(roles, tabCapabilities[route.name] ?? 'canUseApp') ? undefined : null,
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: styles.label,
          tabBarAllowFontScaling: false,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.primary,
            color: theme.colors.onPrimary,
            fontSize: 10,
            fontWeight: '700',
          },
          // Height grows with the system navigation area so gesture and 3-button bars never overlap icons.
          tabBarStyle: {
            backgroundColor: theme.colors.tabBar,
            borderTopColor: theme.colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: spacing.tabBar + insets.bottom,
            paddingTop: spacing.xs + 2,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            elevation: 0,
          },
          tabBarItemStyle: styles.item,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? pair[0] : pair[1]} size={24} color={color} />
          ),
        };
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home feed' }} />
      <Tabs.Screen name="discover" options={{ title: 'People' }} />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Messages',
          tabBarBadge: badge(unreadMessages),
          tabBarAccessibilityLabel: unreadMessages
            ? `Messages, ${unreadMessages} unread`
            : 'Messages',
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarBadge: badge(activityBadge),
          tabBarAccessibilityLabel: activityBadge ? `Activity, ${activityBadge} new` : 'Activity',
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
const styles = StyleSheet.create({
  item: { minHeight: spacing.touch },
  label: { fontSize: typography.size.xs - 1, fontWeight: '600', marginTop: 2 },
});
