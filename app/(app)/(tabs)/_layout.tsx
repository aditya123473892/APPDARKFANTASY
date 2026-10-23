import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadMessageCount } from '@/features/chat/hooks/useChat';
import { useIncomingRequestCount } from '@/features/requests/hooks/useRequests';
import { useUnreadNotificationCount } from '@/features/activity/hooks/useActivity';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useRoles } from '@/features/auth/hooks/useCurrentUser';
import { hasCapability, type Capability } from '@/features/auth/permissions';
import { TabBar } from '@/components/ui/TabBar';
import { Text } from '@/components/ui/Text';
const tabCapabilities: Record<string, Capability> = {
  home: 'canUseApp',
  discover: 'canUseApp',
  events: 'canUseApp',
  chats: 'canSendMessages',
  activity: 'canUseApp',
  profile: 'canUseApp',
};

type IconName = keyof typeof Ionicons.glyphMap;
const icons: Record<string, [IconName, IconName]> = {
  home: ['home', 'home-outline'],
  discover: ['compass', 'compass-outline'],
  events: ['calendar', 'calendar-outline'],
  chats: ['chatbubbles', 'chatbubbles-outline'],
  activity: ['heart', 'heart-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};
const labels: Record<string, string> = {
  home: 'Home',
  discover: 'Discover',
  events: 'Events',
  chats: 'Chats',
  activity: 'Activity',
  profile: 'Profile',
};

export default function TabsLayout(): React.JSX.Element {
  const roles = useRoles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const unreadMessages = useUnreadMessageCount();
  const incomingRequests = useIncomingRequestCount();
  const activityBadge = incomingRequests + useUnreadNotificationCount();
  const badge = (count: number) => (count > 0 ? (count > 99 ? '99+' : count) : undefined);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
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
          tabBarLabel: ({ focused }) => (
            <Text
              variant="caption"
              style={[
                styles.label,
                { color: focused ? theme.colors.primaryText : theme.colors.textMuted },
              ]}
            >
              {labels[route.name] ?? route.name}
            </Text>
          ),
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
          tabBarIcon: ({ focused }) => (
            <View style={[styles.icon, focused && { backgroundColor: theme.colors.primarySoft }]}>
              <Ionicons
                name={focused ? pair[0] : pair[1]}
                size={22}
                color={focused ? theme.colors.primaryText : theme.colors.textMuted}
              />
            </View>
          ),
        };
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home feed' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
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
  icon: {
    width: 52,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: typography.size.xs - 1, fontFamily: typography.family.semibold, marginTop: 2 },
});
