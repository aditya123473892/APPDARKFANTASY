// Use the router's public JavaScript tabs API and navigation context.
import {
  BottomTabBar,
  type BottomTabBarProps,
} from 'expo-router/js-tabs';

/** Retains router links, accessibility, badges, and tab-press events. */
export function TabBar(props: BottomTabBarProps): React.JSX.Element {
  return <BottomTabBar {...props} />;
}
