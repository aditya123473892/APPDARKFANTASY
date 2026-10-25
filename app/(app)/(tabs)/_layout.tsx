import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadMessageCount } from '@/features/chat/hooks/useChat';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { TabBar } from '@/components/ui/TabBar';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  events: 'calendar-outline',
  'god-chat': 'sparkles-outline',
  chats: 'chatbubbles-outline',
};
export default function TabsLayout(): React.JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const unread = useUnreadMessageCount();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      backBehavior="history"
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primaryText,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: spacing.tabBar + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          elevation: 0,
        },
        tabBarItemStyle: { minHeight: spacing.touch },
        tabBarBadgeStyle: {
          backgroundColor: theme.colors.primary,
          color: theme.colors.onPrimary,
          width: spacing.sm,
          minWidth: spacing.sm,
          height: spacing.sm,
          paddingHorizontal: spacing.none,
          borderRadius: spacing.xs,
        },
        tabBarIcon: ({ focused }) => (
          <Ionicons
            name={icons[route.name] ?? 'home-outline'}
            size={24}
            color={focused ? theme.colors.primaryText : theme.colors.textMuted}
          />
        ),
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="god-chat" options={{ title: 'Chat with God' }} />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Messages',
          tabBarBadge: unread > 0 ? '' : undefined,
          tabBarAccessibilityLabel: unread ? `Messages, ${unread} unread` : 'Messages',
        }}
      />
    </Tabs>
  );
}
const styles = StyleSheet.create({
  label: { fontSize: typography.size.xs, fontFamily: typography.family.medium },
});
