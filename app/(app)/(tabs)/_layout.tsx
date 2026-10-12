import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const icons = {
  home: ['home', 'home-outline'], discover: ['search', 'search-outline'], create: ['add', 'add'],
  matches: ['heart', 'heart-outline'], profile: ['person', 'person-outline'], chats: ['chatbubble', 'chatbubble-outline'],
} as const;

export default function TabsLayout(): React.JSX.Element {
  const { theme } = useTheme();
  return <Tabs screenListeners={{ tabPress: () => { void Haptics.selectionAsync(); } }} screenOptions={({ route }) => {
    const pair = icons[route.name as keyof typeof icons] ?? icons.home;
    return {
      headerShown: false, tabBarShowLabel: false, tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: { backgroundColor: theme.colors.tabBar, borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, height: spacing.tabBar, paddingTop: spacing.sm, paddingBottom: spacing.sm },
      tabBarItemStyle: styles.item,
      tabBarIcon: ({ focused, color }) => route.name === 'create'
        ? <View style={[styles.create, { borderColor: focused ? theme.colors.primary : theme.colors.textSecondary }]}><Ionicons name="add" size={25} color={focused ? theme.colors.primary : theme.colors.textSecondary} /></View>
        : <Ionicons name={focused ? pair[0] : pair[1]} size={25} color={color} />,
    };
  }}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
    <Tabs.Screen name="create" options={{ title: 'Create' }} />
    <Tabs.Screen name="matches" options={{ title: 'Activity' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    <Tabs.Screen name="chats" options={{ href: null }} />
  </Tabs>;
}
const styles = StyleSheet.create({ item: { minHeight: spacing.touch }, create: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' } });
